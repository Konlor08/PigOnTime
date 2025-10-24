// src/pages/AHDesk.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

/* Leaflet */
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* Leaflet marker assets (ประกาศครั้งเดียว) */
const ICON_RETINA = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const ICON_STD = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const ICON_SHADOW = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
const iconSmall = new L.Icon({
  iconRetinaUrl: ICON_RETINA,
  iconUrl: ICON_STD,
  shadowUrl: ICON_SHADOW,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/* utils */
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-";
const iso = (x) => new Date(x).toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const plusDaysISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const minusDaysISO = (n) => plusDaysISO(-n);
const clip = (s, n = 40) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "-");
const haversineKm = (a, b) => {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
function Pill({ children, color = "slate" }) {
  const m = {
    green: "bg-green-100 text-green-800 border-green-200",
    red: "bg-rose-100 text-rose-800 border-rose-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${m[color]}`}>
      {children}
    </span>
  );
}
function FitBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    const pts = coords || [];
    if (!pts.length) return;
    const ll = pts.map((p) => [p.lat, p.lng]);
    if (ll.length === 1) {
      map.setView(ll[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(ll).pad(0.2));
  }, [coords, map]);
  return null;
}

/* ---------- main ---------- */
export default function AHDesk() {
  const navigate = useNavigate();
  let me = null;
  try {
    me = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    me = null;
  }

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [sessions, setSessions] = useState({});
  const [latestPos, setLatestPos] = useState({});
  const [, setFactories] = useState([]);
  const [factoryBySite, setFactoryBySite] = useState({});
  const [docCountByPlan, setDocCountByPlan] = useState({});
  const [ahByPlan, setAhByPlan] = useState({});
  const [query, setQuery] = useState("");

  const start = minusDaysISO(7);
  const end = plusDaysISO(7);
  const toastErr = (m) => setErr(m);

  /* ✅ ถ้า user หลุด → กลับหน้า login */
  useEffect(() => {
    if (!me?.id) {
      navigate("/login", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // เช็คครั้งเดียวพอเมื่อเข้าเพจ

  /* โหลดโรงงานไว้ชื่อ/พิกัด */
  const loadFactories = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("factories").select("id,site,name,lat,lng");
      if (error) throw error;
      setFactories(data || []);
      const map = Object.fromEntries(
        (data || []).map((f) => [f.site, { name: f.name || f.site, lat: f.lat, lng: f.lng }])
      );
      setFactoryBySite(map);
    } catch (e) {
      console.log("loadFactories:", e?.message);
    }
  }, []);
  useEffect(() => {
    loadFactories();
  }, [loadFactories]);

  /* โหลดแผน/สถานะ/พิกัดล่าสุด + เอกสาร + รายงาน AH */
  const loadQueues = useCallback(async () => {
    setErr("");
    setBusy(true);
    try {
      /* ✅ กันเคสดึงข้อมูลโดยไม่มีผู้ใช้ */
      if (!me?.id) {
        setBusy(false);
        return;
      }

      // ฟาร์มที่ AH ดูแล (active)
      const { data: rel, error: e1 } = await supabase
        .from("ah_farm_relations")
        .select("farm_id, status, farms(id,plant,branch,house,farm_name)")
        .eq("ah_id", me.id)
        .eq("status", "active");
      if (e1) throw e1;
      const myFarms = (rel || []).map((r) => r.farms).filter(Boolean);
      const farmIds = new Set((rel || []).map((r) => r.farm_id));

      // แผนในช่วง -7..+7
      const { data: plans, error: e2 } = await supabase
        .from("planning_plan_full")
        .select(
          "id,delivery_date,delivery_time,plant,branch,house,farm_id,farm_name,plate,factory,quantity"
        )
        .gte("delivery_date", start)
        .lte("delivery_date", end)
        .order("delivery_date", { ascending: true });
      if (e2) throw e2;

      // คัดเฉพาะฟาร์มที่ดูแล (รองรับกรณี plan ที่ยังไม่มี farm_id)
      const isMyFarm = (p) => {
        if (p.farm_id && farmIds.has(p.farm_id)) return true;
        return myFarms.some(
          (f) =>
            (f.plant || "") === (p.plant || "") &&
            (f.branch || "") === (p.branch || "") &&
            (f.house || "") === (p.house || "") &&
            (f.farm_name || "") === (p.farm_name || "")
        );
      };
      const myPlans = (plans || []).filter(isMyFarm);
      const planIds = myPlans.map((p) => p.id);

      // session ล่าสุดของแต่ละแผน
      let sessMap = {};
      if (planIds.length) {
        const { data: sess, error: e3 } = await supabase
          .from("driver_trip_sessions")
          .select("id,plan_id,arrived_farm_at,left_farm_at,arrived_factory_at,completed,created_at")
          .in("plan_id", planIds)
          .order("created_at", { ascending: false });
        if (e3) throw e3;
        (sess || []).forEach((s) => {
          if (!sessMap[s.plan_id]) sessMap[s.plan_id] = s;
        });
      }

      // พิกัดล่าสุดต่อ session
      let latestMap = {};
      for (const s of Object.values(sessMap)) {
        const { data: pos } = await supabase
          .from("driver_positions")
          .select("lat,lng,speed_kmh,recorded_at")
          .eq("session_id", s.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pos)
          latestMap[s.plan_id] = {
            lat: pos.lat,
            lng: pos.lng,
            at: pos.recorded_at,
            speed_kmh: pos.speed_kmh ?? null,
          };
      }

      // เอกสารของแต่ละแผน
      const docCount = {};
      try {
        const { data: albums } = await supabase
          .from("plan_doc_albums")
          .select("id, plan_id")
          .in("plan_id", planIds);
        const albumIds = (albums || []).map((a) => a.id);
        if (albumIds.length) {
          const { data: files } = await supabase
            .from("plan_doc_files")
            .select("id, album_id")
            .in("album_id", albumIds);
          const byAlbum = {};
          (files || []).forEach((f) => {
            byAlbum[f.album_id] = (byAlbum[f.album_id] || 0) + 1;
          });
          (albums || []).forEach((a) => {
            docCount[a.plan_id] = (docCount[a.plan_id] || 0) + (byAlbum[a.id] || 0);
          });
        }
      } catch {
        /* optional */
      }

      // รายงาน AH (ถ้ามี) — ล่าสุดต่อแผน
      const ahMap = {};
      try {
        const { data: ah } = await supabase
          .from("ah_farm_reports")
          .select("plan_id, farm_condition, weather, created_at")
          .in("plan_id", planIds)
          .order("created_at", { ascending: false });
        (ah || []).forEach((r) => {
          if (!ahMap[r.plan_id]) {
            ahMap[r.plan_id] = {
              condition: r.farm_condition || null,
              weather: r.weather || null,
              at: r.created_at,
            };
          }
        });
      } catch {
        /* optional */
      }

      setRows(myPlans || []);
      setSessions(sessMap);
      setLatestPos(latestMap);
      setDocCountByPlan(docCount);
      setAhByPlan(ahMap);
    } catch (e) {
      toastErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }, [me?.id, start, end]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  /* ETA: ล่าสุด → โรงงานปลายทาง */
  function calcEtaMin(plan) {
    const pos = latestPos[plan.id];
    const fac = factoryBySite[plan.factory];
    if (!pos || !fac?.lat || !fac?.lng) return null;
    const distKm = haversineKm(pos, { lat: fac.lat, lng: fac.lng });
    const speed = pos.speed_kmh && pos.speed_kmh > 3 ? pos.speed_kmh : 40;
    const min = Math.round((distKm / speed) * 60);
    return Math.max(1, min);
  }

  /* ฟิลเตอร์ค้นหา */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.delivery_date, r.farm_name, r.plant, r.branch, r.house, r.plate, r.factory]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  /* ข้อมูลสำหรับ “แผนที่เดียว” */
  const overviewMarkers = useMemo(
    () => filtered.map((p) => (latestPos[p.id] ? { plan: p, pos: latestPos[p.id] } : null)).filter(Boolean),
    [filtered, latestPos]
  );

  const overviewCoords = useMemo(() => {
    const pts = [];
    overviewMarkers.forEach((m) => pts.push({ lat: m.pos.lat, lng: m.pos.lng }));
    filtered.forEach((p) => {
      const fac = factoryBySite[p.factory];
      if (fac?.lat && fac?.lng) pts.push({ lat: fac.lat, lng: fac.lng });
    });
    return pts;
  }, [overviewMarkers, filtered, factoryBySite]);

  /* logout → กลับหน้า AHHome */
  const doLogout = () => {
    try {
      localStorage.removeItem("user");
    } catch {
      /* noop */
    }
    navigate("/ah", { replace: true });
  };

  return (
    <div className="min-h-screen bg-emerald-50">
      {/* ===== HEADER: เรียบง่าย + ปุ่ม Logout (พาไป AHHome) ===== */}
      <header className="bg-emerald-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">สถานะการจัดส่งตามแผน Animal husbandry</h1>
         <Link
      to="/ah"
      className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
    >
      กลับหน้า Animal husbandry
    </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {/* Controls */}
        <div className="rounded-xl border border-emerald-200 bg-white p-3 flex items-center justify-between">
          <div className="space-x-2">
            <Pill color="green">
              ช่วง: {fmtDate(start)} → {fmtDate(end)}
            </Pill>
            <Pill>วันนี้: {todayISO()}</Pill>
          </div>
        <div className="flex gap-2 items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหา (วันที่/ฟาร์ม/ทะเบียน/โรงงาน)"
              className="rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 w-72"
            />
            <button
              type="button"
              onClick={loadQueues}
              className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={busy}
            >
              รีเฟรช
            </button>
          </div>
        </div>

        {/* แผนที่เดียว — รวมรถทุกคันของฟาร์มที่ดูแล */}
        <div className="rounded-xl border border-emerald-200 bg-white p-2">
          <div className="px-2 py-1 text-sm text-gray-600">แผนที่รวมรถขนส่ง (ฟาร์มที่ฉันดูแล)</div>
          <div className="h-[520px] rounded-lg overflow-hidden border border-emerald-200">
            <MapContainer className="h-full w-full" center={[13.736717, 100.523186]} zoom={12} scrollWheelZoom>
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds coords={overviewCoords} />

              {/* จุดโรงงานปลายทาง */}
              {filtered.map((p) => {
                const fac = factoryBySite[p.factory];
                if (!fac?.lat || !fac?.lng) return null;
                return (
                  <Marker key={`fac-${p.id}`} position={[fac.lat, fac.lng]} icon={iconSmall}>
                    <Tooltip permanent direction="top" offset={[0, -10]}>
                      โรงงาน: {fac.name}
                    </Tooltip>
                    <Popup>โรงงานปลายทาง: {fac.name}</Popup>
                  </Marker>
                );
              })}

              {/* รถทุกคัน */}
              {overviewMarkers.map(({ plan, pos }) => {
                const s = sessions[plan.id];
                const status = s?.completed
                  ? "completed"
                  : s?.arrived_factory_at
                  ? "arrived_factory"
                  : s?.left_farm_at
                  ? "left_farm"
                  : s?.arrived_farm_at
                  ? "at_farm"
                  : "pending";
                const facName = factoryBySite[plan.factory]?.name || plan.factory || "-";
                const docs = docCountByPlan[plan.id] || 0;
                const ah = ahByPlan[plan.id];
                const etaMin = calcEtaMin(plan);

                return (
                  <Marker key={plan.id} position={[pos.lat, pos.lng]} icon={iconSmall}>
                    <Tooltip permanent direction="top" offset={[0, -10]}>
                      รถ {plan.plate || "-"} • {status} • ไป {facName}
                      {etaMin ? ` • ETA ${etaMin}น.` : ""}
                    </Tooltip>
                    <Popup>
                      <div className="font-medium mb-1">{plan.farm_name || "-"}</div>
                      ล่าสุด: {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
                      <br />
                      เวลา: {fmtTime(pos.at)}
                      <br />
                      ทะเบียน: {plan.plate || "-"}
                      <br />
                      ปลายทาง: {facName}
                      <br />
                      เอกสาร: {docs ? `${docs} ไฟล์` : "-"}
                      <br />
                      AH รายงาน: {ah ? `${clip(ah.condition, 40)} • อากาศ ${ah.weather || "-"}` : "-"}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* ตารางคิว */}
        <div className="space-y-3">
          {busy && <div className="text-gray-500">กำลังโหลด…</div>}
          {!busy && filtered.length === 0 && (
            <div className="rounded-lg border border-emerald-200 bg-white p-4 text-gray-600">
              ไม่พบคิวในช่วงเวลานี้
            </div>
          )}

          {filtered.map((r) => {
            const sess = sessions[r.id];
            const last = latestPos[r.id];
            const etaMin = calcEtaMin(r);
            const facName = factoryBySite[r.factory]?.name || r.factory || "-";
            const docs = docCountByPlan[r.id] || 0;
            const ah = ahByPlan[r.id];

            const status = sess?.completed
              ? "completed"
              : sess?.arrived_factory_at
              ? "arrived_factory"
              : sess?.left_farm_at
              ? "left_farm"
              : sess?.arrived_farm_at
              ? "at_farm"
              : "pending";

            return (
              <div key={r.id} className="rounded-xl border border-emerald-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {r.delivery_date} • {r.plant}/{r.branch}/{r.house} — {r.farm_name || "-"} · รถ{" "}
                    {r.plate || "-"} · ไป {facName}
                  </div>
                  <div className="space-x-2">
                    <Pill
                      color={
                        status === "completed" || status === "arrived_factory"
                          ? "green"
                          : status === "left_farm"
                          ? "blue"
                          : status === "at_farm"
                          ? "amber"
                          : "slate"
                      }
                    >
                      {status}
                    </Pill>
                    {etaMin ? <Pill color="blue">ETA ~ {etaMin} นาที</Pill> : null}
                    {last ? <Pill color="slate">{fmtTime(last.at)}</Pill> : null}
                    <Pill color={docs ? "green" : "slate"}>Docs: {docs || "-"}</Pill>
                    {ah ? (
                      <Pill color="amber">AH: {clip(ah.condition, 20)} / {ah.weather || "-"}</Pill>
                    ) : (
                      <Pill>AH: -</Pill>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
