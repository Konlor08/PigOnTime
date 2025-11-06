// src/pages/CatchingDesk.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";

/* ---------- helpers ---------- */
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

/** แก้ปัญหา UTC: คืนค่า YYYY-MM-DD ตามเวลาท้องถิ่น (Asia/Bangkok) */
const toLocalISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayISO = () => toLocalISODate(new Date());
const plusDaysISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
};

function Pill({ children, color = "slate" }) {
  const map = {
    green: "bg-green-100 text-green-800 border-green-200",
    red: "bg-rose-100 text-rose-800 border-rose-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${map[color]}`}>
      {children}
    </span>
  );
}

/* เวลาเปรียบเทียบกับคิว (รองรับคอลัมน์ time-only เดิม) */
const parsePlanDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const [hh = 0, mm = 0, ss = 0] = String(timeStr).split(":").map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(hh, mm, ss, 0);
  return d;
};

const fmtHM = (d) =>
  d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

const diffLabelFromMs = (ms) => {
  const mins = Math.round(Math.abs(ms) / 60000);
  if (mins === 0) return "ตรงเวลา";
  return ms > 0 ? `ช้ากว่าแผน ${mins} นาที` : `เร็วกว่าแผน ${mins} นาที`;
};

/* ฟอร์แมตจาก timestamp (มาจากวิว) */
const fmtDT = (iso) =>
  iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-";
const fmtD = (iso) => (iso ? new Date(iso).toLocaleDateString("th-TH") : "-");
const fmtT = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-";
const diffPlan = (actualIso, planIso) => {
  if (!actualIso || !planIso) return "";
  return diffLabelFromMs(new Date(actualIso) - new Date(planIso));
};

/* แปลง note ของไฟล์เอกสาร: สถานะตรวจ + หมายเหตุจาก AH */
function parseDocNote(note) {
  const raw = String(note ?? "").trim();
  if (!raw) return { status: "pending", ahNote: "" };
  if (raw === "APPROVED") return { status: "approved", ahNote: "" };
  if (raw.startsWith("REJECT:"))
    return { status: "rejected", reason: raw.slice(7).trim(), ahNote: "" };
  return { status: "pending", ahNote: raw };
}

/* ---------- main ---------- */
export default function CatchingDesk() {
  const navigate = useNavigate();
  let me = null;
  try {
    me = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    me = null;
  }

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [rows, setRows] = useState([]); // รายคิว
  const [query, setQuery] = useState("");

  // รู้ว่าผู้ใช้มีสิทธิ์ฟาร์มหรือไม่: null=ยังไม่รู้, true/false
const [hasFarmAccess, setHasFarmAccess] = useState(null);


  // อินพุตต่อคิว
  const [teamByPlan, setTeamByPlan] = useState({}); // { plan_id: number|string }
  const [noteByPlan, setNoteByPlan] = useState({}); // { plan_id: string }
  const [lastNoteByPlan, setLastNoteByPlan] = useState({}); // { plan_id: string }
  const [actionMsgByPlan, setActionMsgByPlan] = useState({}); // ผลการกดต่อคิว

  // modal เอกสาร
  const [docOpen, setDocOpen] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [docErr, setDocErr] = useState("");
  const [docAlbum, setDocAlbum] = useState(null); // {id, returned_for_fix}
  const [docFiles, setDocFiles] = useState([]); // [{id, file_name, file_url, note}]
  const [docPlanId, setDocPlanId] = useState(null);

  const start = todayISO();
  const end = plusDaysISO(7);

  const toastOk = (m) => {
    setOk(m);
    const t = setTimeout(() => setOk(""), 3000);
    return () => clearTimeout(t);
  };
  const toastErr = (m) => setErr(m);

  // mapping แสดงสถานะเอกสารเป็นภาษาไทย
  const DOC_THAI = { ok: "เรียบร้อย", need_fix: "ตีกลับ", none: "รอดำเนินการ" };
  const DOC_COLOR = { ok: "green", need_fix: "red", none: "slate" };

  /* โหลดคิว + สถานะเอกสาร (กุญแจ farm_id+delivery_date) + หมายเหตุล่าสุด */
  const loadQueues = useCallback(async () => {
    setErr("");
    setBusy(true);
    try {
      if (!me?.id) throw new Error("ไม่พบผู้ใช้ปัจจุบัน");

      const { data: myFarms, error: eF } = await supabase
        .from("catching_farm_relations")
        .select("farm_id, status")
        .eq("catching_id", me.id)
        .eq("status", "active");
      if (eF) throw eF;

      const farmIds = Array.from(new Set((myFarms || []).map((x) => x.farm_id).filter(Boolean)));
      setHasFarmAccess(farmIds.length > 0);

      if (!farmIds.length) {
  setHasFarmAccess(false);
  setRows([]);
  setLastNoteByPlan({});
  return;
}


      const { data, error } = await supabase
        .from("v_plan_queue_simple")
        .select(
          [
            "plan_id",
            "delivery_date",
            "plant",
            "branch",
            "house",
            "farm_name",
            "factory",
            "delivery_time",
            "timetrucktofarm",
            "catch_time",
            "arrive_factory_time",
            "farm_id",
            "catch_plan_ts",
            "catch_plan_date",
            "arrived_farm_at",
            "last_team_count",
            "actual_start_at",
            "actual_end_at",
          ].join(", ")
        )
        .gte("delivery_date", start)
        .lte("delivery_date", end)
        .in("farm_id", farmIds)
        .is("actual_end_at", null) // <<< แสดงเฉพาะคิวที่ยังไม่จบจับ
        .order("delivery_date", { ascending: true })
        .order("plant", { ascending: true })
        .order("branch", { ascending: true })
        .order("house", { ascending: true });
      if (error) throw error;

      const baseRows = data || [];

      if (!baseRows.length) {
        setLastNoteByPlan({});
        setRows([]);
        return;
      }

      // สถานะเอกสารแบบฟาร์ม+วัน
      const farmList = Array.from(new Set(baseRows.map((r) => r.farm_id).filter(Boolean)));

      let albums = [];
      if (farmList.length) {
        const { data: _albums, error: eAlbums } = await supabase
          .from("plan_doc_albums")
          .select("id,farm_id,delivery_date,returned_for_fix")
          .in("farm_id", farmList)
          .gte("delivery_date", start)
          .lte("delivery_date", end);
        if (eAlbums) throw eAlbums;
        albums = _albums || [];
      }

      const key = (fid, d) => `${fid}|${d}`;
      const byKey = new Map(
        (albums || []).map((a) => [
          key(a.farm_id, new Date(a.delivery_date).toISOString().slice(0, 10)),
          a,
        ])
      );
      const albumIds = (albums || []).map((a) => a.id);

      const cntByAlbum = new Map();
      if (albumIds.length) {
        const { data: fs } = await supabase
          .from("plan_doc_files")
          .select("id,album_id")
          .in("album_id", albumIds);
        (fs || []).forEach((f) => cntByAlbum.set(f.album_id, (cntByAlbum.get(f.album_id) || 0) + 1));
      }

      const merged = baseRows.map((r) => {
        const a = byKey.get(key(r.farm_id, r.delivery_date));
        if (!a) return { ...r, ah_doc_status: "none" };
        const c = cntByAlbum.get(a.id) || 0;
        return { ...r, ah_doc_status: a.returned_for_fix ? "need_fix" : c > 0 ? "ok" : "none" };
      });

      // หมายเหตุล่าสุดของคิว
      const planIds = merged.map((r) => r.plan_id);
      let latestNote = {};
      if (planIds.length) {
        const { data: revs } = await supabase
          .from("catching_reviews")
          .select("plan_id, note, created_at")
          .in("plan_id", planIds)
          .order("created_at", { ascending: false });
        for (const r of revs || []) {
          if (!latestNote[r.plan_id] && r.note && String(r.note).trim()) {
            latestNote[r.plan_id] = r.note;
          }
        }
      }
      setLastNoteByPlan(latestNote);

      setRows(merged);
    } catch (e) {
      toastErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
      setHasFarmAccess(null);
    }
  }, [me?.id, start, end]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  /* filter */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.delivery_date, r.farm_name, r.plant, r.branch, r.house, r.factory]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  /* บันทึกจำนวนคน (เก็บไว้ใช้ตอน start/finish) */
  const saveTeamCount = async () => {
    toastOk("จดจำจำนวนทีมจับแล้ว (จะบันทึกจริงตอนเริ่ม/จบจับ)");
  };

  /* เริ่มจับ / จบจับ — แสดงผลเปรียบเทียบกับ “เวลาแผนจับ” (catch_plan_ts) */
  const startCatching = async (row) => {
    const plan_id = row.plan_id;
    const n = Number(teamByPlan[plan_id] ?? 0) || Number(row.last_team_count ?? 0) || 0;
    setErr("");
    setBusy(true);
    try {
      const { error } = await supabase.from("catching_sessions").insert({
        plan_id,
        team_count: n,
        start_at: new Date().toISOString(),
        created_by: me.id,
      });
      if (error) throw error;

      const now = new Date();
      const planDTiso = row.catch_plan_ts || null;
      const msg = planDTiso
        ? `เริ่มจับ ${fmtHM(now)} — ${diffLabelFromMs(now - new Date(planDTiso))} (แผน ${fmtT(
            planDTiso
          )})`
        : `เริ่มจับ ${fmtHM(now)}`;
      setActionMsgByPlan((p) => ({ ...p, [plan_id]: msg }));

      toastOk("เริ่มจับแล้ว");
      loadQueues();
    } catch (e) {
      toastErr(e.message || "เริ่มจับไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const finishCatching = async (row) => {
    const plan_id = row.plan_id;
    const n = Number(teamByPlan[plan_id] ?? 0) || Number(row.last_team_count ?? 0) || 0;
    const note = String(noteByPlan[plan_id] || "").trim() || null;
    setErr("");
    setBusy(true);
    try {
      // ต้องเอกสาร 'เรียบร้อย' เท่านั้น
      if (row.ah_doc_status !== "ok") {
        throw new Error("เอกสารยังไม่เรียบร้อย กรุณาตรวจให้ 'เรียบร้อย' ก่อนปิดคิว");
      }

      const { error: e1 } = await supabase.from("catching_sessions").insert({
        plan_id,
        team_count: n,
        end_at: new Date().toISOString(),
        created_by: me.id,
      });
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("catching_reviews").insert({
        plan_id,
        status: "finished",
        note,
        checked_by: me.id,
      });
      if (e2) throw e2;

      const now = new Date();
      const planDTiso = row.catch_plan_ts || null; // เปรียบเทียบกับ “แผนเวลาจับ”
      const msg = planDTiso
        ? `ปิดคิว ${fmtHM(now)} — ${diffLabelFromMs(now - new Date(planDTiso))} (แผน ${fmtT(
            planDTiso
          )})`
        : `ปิดคิว ${fmtHM(now)}`;
      setActionMsgByPlan((p) => ({ ...p, [plan_id]: msg }));

      // เอาคิวออกจากจอทันที
      setRows((prev) => prev.filter((x) => x.plan_id !== plan_id));

      toastOk("ปิดคิวสำเร็จ");
      // ไม่ reload ทันทีเพื่อความเร็ว ผู้ใช้กดปุ่มรีเฟรชได้ภายหลัง
    } catch (e) {
      toastErr(e.message || "ปิดคิวไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  /* บันทึกหมายเหตุ (ยังคง logic เดิม) */
  const saveNote = async (plan_id) => {
    const note = String(noteByPlan[plan_id] || "").trim();
    if (!note) return;
    setLastNoteByPlan((p) => ({ ...p, [plan_id]: note }));
    toastOk("บันทึกหมายเหตุชั่วคราวแล้ว (จะส่งไปพร้อมตอนปิดคิว)");
  };

  /* ---------- Modal เอกสาร (กุญแจฟาร์ม+วัน) ---------- */
  const openDocs = async (row) => {
    const { plan_id, farm_id, delivery_date } = row;
    setDocErr("");
    setDocBusy(true);
    setDocAlbum(null);
    setDocFiles([]);
    setDocPlanId(plan_id);
    setDocOpen(true);

    try {
      const { data: albums2, error: e2 } = await supabase
        .from("plan_doc_albums")
        .select("id, farm_id, delivery_date, returned_for_fix")
        .eq("farm_id", farm_id)
        .eq("delivery_date", delivery_date)
        .limit(1);
      if (e2) throw e2;

      const album = (albums2 && albums2[0]) || null;
      if (!album) {
        setDocAlbum(null);
        setDocFiles([]);
        return;
      }
      setDocAlbum(album);

      const { data: files, error: e3 } = await supabase
        .from("plan_doc_files")
        .select("id, file_name, file_url, note")
        .eq("album_id", album.id)
        .order("created_at", { ascending: true });
      if (e3) throw e3;

      setDocFiles(files || []);
    } catch (e) {
      setDocErr(e.message || "โหลดเอกสารไม่สำเร็จ");
    } finally {
      setDocBusy(false);
    }
  };

  const closeDocs = () => {
    setDocOpen(false);
    setDocAlbum(null);
    setDocFiles([]);
    setDocErr("");
    setDocPlanId(null);
  };

  // อนุมัติ/ไม่ผ่าน “รายไฟล์”
  const approveFile = async (fileId) => {
    if (!docAlbum?.id) return;
    setDocBusy(true);
    setDocErr("");
    try {
      const { error } = await supabase.from("plan_doc_files").update({ note: "APPROVED" }).eq("id", fileId);
      if (error) throw error;
      setDocFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, note: "APPROVED" } : f)));
    } catch (e) {
      setDocErr(e.message || "อัปเดตสถานะไฟล์ไม่สำเร็จ");
    } finally {
      setDocBusy(false);
    }
  };

  const rejectFile = async (fileId) => {
    if (!docAlbum?.id) return;
    const reason = window.prompt("ระบุเหตุผลที่ไม่ผ่าน:", "");
    if (reason === null) return;
    const text = String(reason).trim();
    if (!text) return;
    setDocBusy(true);
    setDocErr("");
    try {
      const { error } = await supabase.from("plan_doc_files").update({ note: `REJECT:${text}` }).eq("id", fileId);
      if (error) throw error;
      setDocFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, note: `REJECT:${text}` } : f)));
    } catch (e) {
      setDocErr(e.message || "อัปเดตสถานะไฟล์ไม่สำเร็จ");
    } finally {
      setDocBusy(false);
    }
  };

  /* logout */
  const doLogout = () => {
    try {
      localStorage.removeItem("user");
    } catch {}
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="bg-amber-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Catching Desk</h1>
          <button
            type="button"
            onClick={doLogout}
            className="rounded-md bg-amber-300 text-amber-950 px-4 py-2 font-semibold hover:bg-amber-400 active:bg-amber-500"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 flex items-center justify-between">
            <span>{err}</span>
            <button className="text-red-700" onClick={() => setErr("")}>
              ×
            </button>
          </div>
        )}
        {ok && <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">{ok}</div>}

        {/* Filters */}
        <div className="rounded-xl border border-amber-200 bg-white p-3 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="space-x-2">
            <Pill color="amber">วันนี้: {fmtDate(start)}</Pill>
            <Pill>ถึง: {fmtDate(end)}</Pill>
          </div>
          <div className="flex gap-2 items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหา (วันที่/ฟาร์ม/plant-branch-house/โรงงาน)"
              className="rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500 w-72"
            />
            <button
              type="button"
              onClick={loadQueues}
              className="rounded-md bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-60"
              disabled={busy}
            >
              รีเฟรช
            </button>
          </div>
        </div>

        {/* รายการคิว */}
        <div className="space-y-3">
          {busy && <div className="text-gray-500">กำลังโหลด…</div>}
          {!busy && filtered.length === 0 && (
  <div className="rounded-lg border border-amber-200 bg-white p-4 text-gray-600">
    {query?.trim()
      ? "ไม่พบคิวตามเงื่อนไข"
      : hasFarmAccess === false
          ? "คุณยังไม่มีฟาร์มที่รับผิดชอบ หรือยังไม่ได้รับสิทธิ์เข้าถึงฟาร์ม"
          : "ช่วงวันที่นี้ยังไม่มีคิวสำหรับฟาร์มที่คุณรับผิดชอบ"}
  </div>
)}


          {filtered.map((r) => {
            const plan_id = r.plan_id;

            return (
              <div key={plan_id} className="rounded-xl border border-amber-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {r.delivery_date} • {r.plant} / {r.branch} / {r.house} — {r.farm_name || "-"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill color={DOC_COLOR[r.ah_doc_status] || "slate"}>
                      เอกสาร: {DOC_THAI[r.ah_doc_status] || "-"}
                    </Pill>
                    <button
                      type="button"
                      onClick={() => openDocs(r)}
                      className="rounded-md px-3 py-1.5 text-sm border bg-amber-50 border-amber-300 hover:bg-amber-100"
                    >
                      ดูเอกสาร
                    </button>
                  </div>
                </div>

                {/* เวลาสำคัญ */}
                <div className="mt-2 text-sm text-gray-700">
                  โรงงาน: <b>{r.factory || "-"}</b>
                  <div className="text-xs text-gray-600 mt-1">
                    เวลาแผน: <b>{r.delivery_time ?? "-"}</b> · เวลาไปฟาร์ม: <b>{r.timetrucktofarm ?? "-"}</b> ·
                    เวลาจับ: <b>{r.catch_time ?? "-"}</b> · ถึงโรงงาน: <b>{r.arrive_factory_time ?? "-"}</b>
                  </div>

                  <div className="text-xs text-gray-700 mt-1">
                    วันที่จับ(แผน): <b>{fmtD(r.catch_plan_ts)}</b> · เวลาจับ(แผน): <b>{fmtT(r.catch_plan_ts)}</b> ·
                    ถึงฟาร์มจริง: <b>{fmtDT(r.arrived_farm_at)}</b>
                  </div>
                  <div className="text-xs text-gray-700">
                    เริ่มจับจริง: <b>{fmtDT(r.actual_start_at)}</b>{" "}
                    {r.actual_start_at && r.catch_plan_ts ? `(${diffPlan(r.actual_start_at, r.catch_plan_ts)})` : ""}
                    {" · "}จบจับจริง: <b>{fmtDT(r.actual_end_at)}</b>{" "}
                    {r.actual_end_at && r.catch_plan_ts ? `(${diffPlan(r.actual_end_at, r.catch_plan_ts)})` : ""}
                  </div>
                </div>

                {/* ทีมจับสุกร + ปุ่ม */}
                <div className="mt-3 rounded-lg border border-amber-200 p-3">
                  <div className="text-sm text-gray-600 mb-1">ทีมจับสุกร</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={teamByPlan[plan_id] ?? (r.last_team_count ?? "")}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "");
                        setTeamByPlan((p) => ({ ...p, [plan_id]: v }));
                      }}
                      placeholder="จำนวนคน"
                      className="w-32 rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="text-xs text-gray-500">ทีมล่าสุดจากระบบ: {r.last_team_count ?? "-"}</div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={saveTeamCount}
                      className="rounded-md border px-3 py-2 hover:bg-amber-50"
                    >
                      บันทึกจำนวนคน
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startCatching(r)}
                      className="rounded-md bg-amber-600 px-3 py-2 text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      เริ่มจับ
                    </button>
                    <button
                      type="button"
                      disabled={busy || r.ah_doc_status !== "ok"}
                      title={r.ah_doc_status !== "ok" ? "ต้องตรวจเอกสารให้เรียบร้อยก่อนปิดคิว" : ""}
                      onClick={() => finishCatching(r)}
                      className="rounded-md bg-rose-600 px-3 py-2 text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      จบจับ / ปิดคิว
                    </button>
                  </div>

                  {actionMsgByPlan[plan_id] && (
                    <div className="mt-2 text-xs text-gray-700">
                      ผลการกด: <b>{actionMsgByPlan[plan_id]}</b>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ---------- Modal ดูเอกสาร ---------- */}
      {docOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow border border-amber-200">
            <div className="px-4 py-3 bg-amber-100 border-b border-amber-200 rounded-t-xl flex items-center justify-between">
              <div className="font-semibold">เอกสารจาก Animal husbandry</div>
              <button onClick={closeDocs} className="rounded-md px-2 py-1 border border-amber-300 hover:bg-amber-200">
                ปิด
              </button>
            </div>

            <div className="p-4 space-y-3">
              {docErr && (
                <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">{docErr}</div>
              )}

              {docBusy ? (
                <div className="text-gray-500">กำลังโหลดเอกสาร…</div>
              ) : !docAlbum ? (
                <div className="text-gray-600">ไม่พบอัลบั้มเอกสารสำหรับคิวนี้</div>
              ) : (
                <>
                  <div className="text-sm text-gray-700">
                    คิว: <b>{docPlanId}</b> · สถานะ:{" "}
                    {docAlbum.returned_for_fix ? <Pill color="red">ตีกลับ</Pill> : <Pill color="green">เรียบร้อย</Pill>}
                  </div>

                  <div className="rounded border border-amber-200">
                    <div className="px-3 py-2 bg-amber-50 border-b">ไฟล์เอกสาร</div>
                    {docFiles.length ? (
                      <ul className="max-h-[28rem] overflow-auto divide-y">
                        {docFiles.map((f) => {
                          const meta = parseDocNote(f.note);
                          return (
                            <li key={f.id} className="px-3 py-2 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{f.file_name}</div>

                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  {meta.status === "approved" ? (
                                    <Pill color="green">เรียบร้อย</Pill>
                                  ) : meta.status === "rejected" ? (
                                    <>
                                      <Pill color="red">ตีกลับ</Pill>
                                      {meta.reason ? (
                                        <span className="text-xs text-rose-700">เหตุผล: {meta.reason}</span>
                                      ) : null}
                                    </>
                                  ) : (
                                    <Pill>รอดำเนินการ</Pill>
                                  )}
                                  {meta.ahNote ? (
                                    <span className="text-xs text-amber-700">
                                      หมายเหตุจาก AH: <b>{meta.ahNote}</b>
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex gap-2 shrink-0">
                                <a
                                  href={f.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-md border px-3 py-2 hover:bg-amber-50"
                                >
                                  เปิดไฟล์
                                </a>
                                <button
                                  type="button"
                                  onClick={() => approveFile(f.id)}
                                  disabled={docBusy}
                                  className="rounded-md bg-emerald-600 text-white px-3 py-2 hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  อนุมัติไฟล์
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectFile(f.id)}
                                  disabled={docBusy}
                                  className="rounded-md bg-rose-600 text-white px-3 py-2 hover:bg-rose-700 disabled:opacity-60"
                                >
                                  ไม่ผ่าน
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="px-3 py-6 text-center text-gray-500">ยังไม่มีไฟล์</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
