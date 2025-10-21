// src/pages/AHRoutePhotosLite.jsx 
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../supabaseClient";

/* ---------- Banner ---------- */
function Banner({ type = "info", children }) {
  const color =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`mb-4 rounded-lg border px-3 py-2 ${color}`}>{children}</div>;
}

/* ---------- utils ---------- */
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const plusDaysISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const norm = (s) =>
  String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const toTime = (t) => (t == null ? null : String(t).slice(0, 8)); // HH:MM[:SS]
const earlier = (a, b) => {
  if (!a) return b ?? null;
  if (!b) return a ?? null;
  return toTime(a) <= toTime(b) ? a : b;
};

function farmLabel(f) {
  if (!f) return "";
  const code = [f.plant, f.branch, f.house].filter(Boolean).join(" / ");
  return `${code} ${f.farm_name || ""}`.trim();
}

/* ---------- resize ≤ 1MB (JPEG) ---------- */
async function fileToImage(file) {
  const dataUrl = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = dataUrl;
  });
  return img;
}
async function compressImage(
  file,
  { maxEdge = 1600, targetBytes = 1_000_000, mimeType = "image/jpeg", q0 = 0.85 } = {}
) {
  const img = await fileToImage(file);
  let w = img.width,
    h = img.height;
  if (Math.max(w, h) > maxEdge) {
    if (w >= h) {
      h = Math.round(h * (maxEdge / w));
      w = maxEdge;
    } else {
      w = Math.round(w * (maxEdge / h));
      h = maxEdge;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);

  const toBlob = (q) => new Promise((r) => canvas.toBlob(r, mimeType, q));
  let q = q0,
    blob = await toBlob(q);
  while (blob && blob.size > targetBytes && q > 0.5) {
    q -= 0.07;
    blob = await toBlob(q);
  }
  let tries = 0;
  while (blob && blob.size > targetBytes && tries < 2) {
    tries++;
    canvas.width = Math.round(canvas.width * 0.85);
    canvas.height = Math.round(canvas.height * 0.85);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    q = Math.max(0.5, q - 0.07);
    blob = await toBlob(q);
  }
  if (!blob) throw new Error("แปลงรูปไม่สำเร็จ");
  if (blob.size > targetBytes) throw new Error(`ไฟล์ยังเกิน 1MB (${Math.round(blob.size / 1024)} KB)`);
  return new File([blob], `${(file.name || "image").split(".")[0]}.jpg`, { type: mimeType });
}

/* ---------- SearchBox (เพิ่มเวลาจับในตัวกรอง & แสดง) ---------- */
function SearchBox({ list, value, onChange }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((x) =>
      [x.date, x.factory, farmLabel(x.farm), x.catch_time || ""].join(" ").toLowerCase().includes(s)
    );
  }, [q, list]);

  return (
    <div className="rounded-xl border bg-white/90 p-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหา (วันที่/ฟาร์ม/โรงงาน/เวลาจับ)"
        className="mb-2 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <div className="max-h-80 overflow-auto space-y-2">
        {results.map((g) => (
          <button
            key={g.group_key}
            onClick={() => onChange(g)}
            type="button"
            className={`block w-full text-left rounded-md px-3 pb-2 pt-0 border overflow-hidden ${
              value?.group_key === g.group_key ? "ring-2 ring-emerald-500" : ""
            }`}
          >
            {/* แถบสีด้านบน */}
            <div className="h-1 w-full bg-emerald-600 mb-2" />
            <div className="font-medium">
              {g.date} • {farmLabel(g.farm)}
            </div>
            <div className="text-xs text-gray-600">
              โรงงาน: {g.factory || "-"} · แผน {g.plan_count} รอบ · เวลาจับ: {g.catch_time || "-"}
            </div>
          </button>
        ))}
        {!results.length && <div className="text-center text-gray-500 py-6">ไม่พบข้อมูล</div>}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function AHRoutePhotosLite() {
  let me = null;
  try {
    me = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    me = null;
  }

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [groups, setGroups] = useState([]);
  const [sel, setSel] = useState(null);
  const [albumId, setAlbumId] = useState(null);

  const [weather, setWeather] = useState(null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const maxFiles = 3;

  const onAnyAction = (fn) => async (...args) => {
    if (err) setErr("");
    return fn?.(...args);
  };

  /* โหลดคิววันนี้ → +7 วัน (แก้: ใช้ farm_id ก่อน + เพิ่ม catch_time) */
  const loadPending = useCallback(async () => {
    setErr("");
    setBusy(true);
    try {
      if (!me?.id) throw new Error("ไม่พบผู้ใช้ปัจจุบัน");

      // ฟาร์มที่ฉันดูแล (ใช้ alias 'farm' + กรอง active)
      const { data: rel, error: e1 } = await supabase
        .from("ah_farm_relations")
        .select("farm_id, farm:farms(id, plant, branch, house, farm_name, lat, long)")
        .eq("ah_id", me.id)
        .eq("status", "active");
      if (e1) throw e1;
      const myFarms = (rel || []).map((r) => r.farm).filter(Boolean);
      const farmById = new Map(myFarms.map((f) => [f.id, f]));

      // แผนวันนี้..+7 (เพิ่ม farm_id และเวลาจับ — รองรับทั้ง catch_time และ "เวลาจับ")
      const start = todayISO();
      const end = plusDaysISO(7);
      const { data: plans, error: e2 } = await supabase
        .from("planning_plan_full")
        .select(
          [
            "id",
            "delivery_date",
            "plant",
            "branch",
            "house",
            "farm_name",
            "factory",
            "farm_id",
            "catch_time",
            '"เวลาจับ"'
          ].join(", ")
        )
        .gte("delivery_date", start)
        .lte("delivery_date", end);
      if (e2) throw e2;

      // จับคู่ฟาร์ม: ใช้ id ก่อน → ไม่เจอค่อย normalize
      const map = new Map();
      for (const p of plans || []) {
        let f = null;
        if (p.farm_id) f = farmById.get(p.farm_id);
        if (!f) {
          f = myFarms.find(
            (x) =>
              norm(x.plant) === norm(p.plant) &&
              norm(x.branch) === norm(p.branch) &&
              norm(x.house) === norm(p.house) &&
              norm(x.farm_name) === norm(p.farm_name)
          );
        }
        if (!f) continue;

        // เวลาจับ (เลือกเวลาที่เร็วสุดในกลุ่ม)
        const catchTxt = p["เวลาจับ"] ?? null;
        const thisCatch = p.catch_time ?? catchTxt ?? null;

        const date = iso(p.delivery_date);
        const key = `${date}::${f.id}`;
        const cur =
          map.get(key) || {
            group_key: key,
            date,
            farm: f,
            factory: p.factory || null,
            plan_count: 0,
            catch_time: null
          };
        cur.plan_count += 1;
        cur.catch_time = earlier(cur.catch_time, thisCatch);
        map.set(key, cur);
      }

      const all = Array.from(map.values());
      if (!all.length) {
        setGroups([]);
        setBusy(false);
        return;
      }

      // หา/นับอัลบั้มรูป
      const { data: albums } = await supabase
        .from("route_photo_albums")
        .select("id, group_key")
        .in("group_key", all.map((g) => g.group_key));
      const albumByKey = new Map((albums || []).map((a) => [a.group_key, a.id]));
      const ids = (albums || []).map((a) => a.id);

      let countByAlbum = new Map();
      if (ids.length) {
        const { data: ph } = await supabase.from("route_photo_files").select("id, album_id").in("album_id", ids);
        countByAlbum = new Map();
        for (const r of ph || []) countByAlbum.set(r.album_id, (countByAlbum.get(r.album_id) || 0) + 1);
      }

      // เฉพาะรายการที่ยังไม่มีรูป
      const pending = all
        .filter((g) => {
          const aid = albumByKey.get(g.group_key);
          if (!aid) return true;
          const c = countByAlbum.get(aid) || 0;
          return c === 0;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      setGroups(pending);
    } catch (e) {
      setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }, [me?.id]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  /* เมื่อเลือก group → หา/สร้างอัลบั้ม + ดึงอากาศ */
  useEffect(() => {
    const go = async () => {
      setAlbumId(null);
      setWeather(null);
      setFiles([]);
      setNote("");
      if (!sel) return;

      const { data: existed } = await supabase
        .from("route_photo_albums")
        .select("id")
        .eq("group_key", sel.group_key)
        .maybeSingle();
      let aid = existed?.id;
      if (!aid) {
        const { data: ins, error: eIns } = await supabase
          .from("route_photo_albums")
          .insert({
            group_key: sel.group_key,
            delivery_date: sel.date,
            farm_id: sel.farm.id,
            ah_id: me?.id || null
          })
          .select("id")
          .single();
        if (eIns) {
          setErr(eIns.message);
          return;
        }
        aid = ins.id;
      }
      setAlbumId(aid);

      const lat = sel.farm.lat,
        lng = sel.farm.long;
      if (lat == null || lng == null) return;

      try {
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", String(lat));
        url.searchParams.set("longitude", String(lng));
        url.searchParams.set("current", "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m");
        url.searchParams.set("timezone", "auto");
        const r = await fetch(url.toString());
        const j = await r.json();
        setWeather({
          temp: j?.current?.temperature_2m ?? null,
          humid: j?.current?.relative_humidity_2m ?? null,
          rain: j?.current?.precipitation ?? null,
          wind: j?.current?.wind_speed_10m ?? null,
          raw: j || null
        });
      } catch {
        /* ignore */
      }
    };
    go();
  }, [sel, me?.id]);

  /* เลือกไฟล์ + ย่อ ≤ 1MB */
  const onPick = async (e) => {
    const chosen = Array.from(e.target.files || []);
    e.target.value = "";
    const remain = maxFiles - files.length;
    if (remain <= 0) {
      setErr(`อัลบั้มนี้เก็บได้สูงสุด ${maxFiles} รูป`);
      return;
    }

    try {
      const out = [];
      for (const f of chosen.slice(0, remain)) {
        if (f.type && !/^image\//i.test(f.type)) continue;
        const small = await compressImage(f);
        out.push({ file: small, previewUrl: URL.createObjectURL(small) });
      }
      setFiles((old) => [...old, ...out]);
      setErr("");
    } catch (ex) {
      setErr(ex.message || "ย่อรูปไม่สำเร็จ");
    }
  };

  /* อัปโหลดทั้งหมด */
  const uploadAll = async () => {
    setErr("");
    setMsg("");
    if (!albumId) return setErr("ยังไม่ได้เลือกแผน");
    if (!files.length) return setErr("ยังไม่เลือกรูป");

    setBusy(true);
    try {
      for (const it of files) {
        const f = it.file;
        const fileName = `${crypto.randomUUID()}.jpg`;
        const path = `${albumId}/${fileName}`;

        const { error: eu } = await supabase.storage
          .from("route-photos")
          .upload(path, f, { contentType: f.type || "image/jpeg", upsert: false, cacheControl: "3600" });
        if (eu) throw eu;

        const { data: pub } = await supabase.storage.from("route-photos").getPublicUrl(path);

        const w = weather || null;
        const { error: ei } = await supabase.from("route_photo_files").insert({
          album_id: albumId,
          note,
          file_url: pub.publicUrl,
          file_name: path,
          file_bytes: f.size,
          mime_type: f.type || "image/jpeg",
          weather_at: new Date().toISOString(),
          weather_source: "open-meteo",
          temp_c: w?.temp ?? null,
          humidity_pct: w?.humid ?? null,
          rain_mm: w?.rain ?? null,
          wind_speed_kmh: w?.wind ?? null,
          weather_raw: w?.raw ?? null
        });
        if (ei) throw ei;
      }

      setMsg("อัปโหลดสำเร็จ");
      setTimeout(() => setMsg(""), 3000);

      setFiles([]);
      setGroups((old) => old.filter((g) => g.group_key !== sel.group_key)); // ทำเสร็จ → เอาออกจากคิว
      setSel(null);
      setAlbumId(null);
      setWeather(null);
      setNote("");
    } catch (e) {
      setErr(e.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50">
      <header className="bg-emerald-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">อัปโหลดรูปสภาพเส้นทาง (คิววันนี้ → +7 วัน)</h1>
          <Link to="/ah" className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20">
            กลับหน้า Animal husbandry
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {err && <Banner type="error">{err}</Banner>}
        {msg && <Banner type="success">{msg}</Banner>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* คิวที่ยังไม่ได้ทำ */}
          <div className="md:col-span-2">
            <div className="font-semibold mb-2">คิวที่ยังไม่ได้ทำ (วันนี้ → ล่วงหน้า 7 วัน)</div>
            <SearchBox list={groups} value={sel} onChange={setSel} />
            {busy && <div className="text-gray-500 mt-3">กำลังโหลด…</div>}
            {!busy && !groups.length && <div className="text-gray-500 mt-3">ไม่มีคิวค้าง</div>}
          </div>

          {/* แผงอัปโหลด */}
          <div className="space-y-3">
            <div className="rounded-xl border bg-white/90 p-3">
              <div className="font-semibold mb-2">อัลบั้ม</div>
              <div className="text-sm text-gray-700">
                วันที่: <b>{sel?.date || "-"}</b>
                <br />
                ฟาร์ม: <b>{sel ? farmLabel(sel.farm) : "-"}</b>
                <div className="text-xs text-gray-600 mt-1">
                  เวลาจับ: <b>{sel?.catch_time || "-"}</b>
                </div>
              </div>

              <div className="mt-3 rounded-md border bg-emerald-50/60 p-2">
                <div className="text-sm font-medium">สภาพอากาศ (ปัจจุบัน)</div>
                {sel?.farm?.lat == null || sel?.farm?.long == null ? (
                  <div className="text-xs text-gray-600 mt-1">ฟาร์มนี้ยังไม่มีพิกัด</div>
                ) : weather ? (
                  <div className="text-sm mt-1">
                    อุณหภูมิ {weather.temp ?? "-"}°C · ความชื้น {weather.humid ?? "-"}% · ฝน {weather.rain ?? "-"} mm ·
                    ลม {weather.wind ?? "-"} km/h
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 mt-1">กำลังดึงข้อมูลอากาศ…</div>
                )}
                <div className="text-[11px] text-gray-500 mt-1">* ตอนอัปโหลดจะบันทึกค่านี้ลงรูปแต่ละไฟล์</div>
              </div>

              <label className="block text-sm text-gray-600 mt-3">หมายเหตุ</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น ถนนชำรุด/น้ำขัง"
                className="mb-2 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onAnyAction(onPick)}
                className="mb-2 block w-full text-sm"
                disabled={!sel}
              />
              <div className="text-xs text-gray-600 mb-2">ระบบย่อไฟล์ ≤ 1MB สูงสุด {maxFiles} รูป</div>

              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {files.map((it, i) => (
                    <div key={i} className="w-24 h-24 rounded-md border overflow-hidden">
                      <img src={it.previewUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onAnyAction(uploadAll)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={busy || !sel || !files.length}
                >
                  อัปโหลด & ทำรายการนี้ให้เสร็จ
                </button>
                <button
                  type="button"
                  onClick={onAnyAction(() => setFiles([]))}
                  className="rounded-md bg-gray-200 px-4 py-2 hover:bg-gray-300"
                >
                  ล้างรูปที่เลือก
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
