// src/pages/admin/AdminAllTrucks.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

/* Leaflet */
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* Fix Leaflet marker assets (Vite) + สร้าง icon (ประกาศครั้งเดียวพอ) */
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

/* ---------- helpers ---------- */
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-");
const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };
const clip = (s, n = 40) => (s && s.length > n ? s.slice(0, n - 1) + "…" : (s || "-"));

function haversineKm(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function Pill({ children, color = "slate" }) {
  const map = {
    green: "bg-green-100 text-green-800 border-green-200",
    red: "bg-rose-100 text-rose-800 border-rose-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${map[color]}`}>{children}</span>;
}

/* Fit bounds of overview map */
function FitBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    const pts = coords || [];
    if (pts.length === 0) return;
    const ll = pts.map(p => [p.lat, p.lng]);
    if (ll.length === 1) { map.setView(ll[0], 13); return; }
    map.fitBounds(L.latLngBounds(ll).pad(0.2));
  }, [coords, map]);
  return null;
}

/* ---------- main ---------- */
export default function AdminAllTrucks() {
  const navigate = useNavigate();

  // session (อ่านจาก localStorage)
  let me = null;
  try { me = JSON.parse(localStorage.getItem("user") || "null"); } catch { me = null; }
  const isAdmin = (me?.role || "").toLowerCase() === "admin";

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [factories, setFactories] = useState([]);        // [{id,site,name,lat,lng}]
  const [rows, setRows] = useState([]);                  // plans
  const [sessions, setSessions] = useState({});          // plan_id -> session
  const [latestPos, setLatestPos] = useState({});        // plan_id -> {lat,lng,at,speed_kmh}
  const [ahByPlan, setAhByPlan] = useState({});          // plan_id -> {condition, weather, at}
  const [docCountByPlan, setDocCountByPlan] = useState({}); // plan_id -> count
  const [query, setQuery] = useState("");

  const start = todayISO();
  const end = plusDaysISO(1);

  const toastOk = (m) => { setOk(m); setTimeout(()=>setOk(""), 3000); };
  const toastErr = (m) => setErr(m);

  /* guard: ถ้าไม่ใช่ admin ให้เด้งออก */
  useEffect(() => {
    if (!me?.id) navigate("/login", { replace: true });
  }, [me?.id, navigate]);

  /* โหลดโรงงานทั้งหมด (ใช้ทำ site -> coord map) */
  const loadFactories = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("factories").select("id, site, name, lat, lng").order("name");
      if (error) throw error;
      setFactories(data || []);
    } catch (e) {
      toastErr(e.message || "โหลดรายชื่อโรงงานไม่สำเร็จ");
    }
  }, []);

  useEffect(() => { loadFactories(); }, [loadFactories]);

  const siteToFactory = useMemo(() => {
    const m = {};
    (factories || []).forEach(f => { if (f?.site) m[f.site] = f; });
    return m;
  }, [factories]);

  /* โหลดทุกคิว (ทุกโรงงาน) ช่วงวันนี้→พรุ่งนี้ */
  const loadQueues = useCallback(async () => {
    if (!isAdmin) return;
    setErr(""); setBusy(true);
    try {
      const { data: plans, error: e1 } = await supabase
        .from("planning_plan_full")
        .select("id, delivery_date, delivery_time, plant, branch, house, farm_name, plate, factory, quantity")
        .gte("delivery_date", start)
        .lte("delivery_date", end)
        .order("delivery_date", { ascending: true });
      if (e1) throw e1;

      const planIds = (plans || []).map(p => p.id);

      // session ล่าสุดของแต่ละแผน
      let sessMap = {};
      if (planIds.length) {
        const { data: sess, error: e2 } = await supabase
          .from("driver_trip_sessions")
          .select("id,plan_id,driver_id,truck_id,arrived_farm_at,left_farm_at,arrived_factory_at,completed,created_at")
          .in("plan_id", planIds)
          .order("created_at", { ascending: false });
        if (e2) throw e2;
        (sess || []).forEach(s => { if (!sessMap[s.plan_id]) sessMap[s.plan_id] = s; });
      }

      // พิกัดล่าสุดของแต่ละ session
      let latestMap = {};
      const sessList = Object.values(sessMap);
      for (const s of sessList) {
        const { data: pos } = await supabase
          .from("driver_positions")
          .select("lat,lng,speed_kmh,recorded_at")
          .eq("session_id", s.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pos) latestMap[s.plan_id] = { lat: pos.lat, lng: pos.lng, at: pos.recorded_at, speed_kmh: pos.speed_kmh ?? null };
      }

      // เอกสารของแต่ละแผน
      const docCount = {};
      try {
        const { data: albums } = await supabase
          .from("plan_doc_albums")
          .select("id, plan_id")
          .in("plan_id", planIds);
        const albumIds = (albums || []).map(a => a.id);
        if (albumIds.length) {
          const { data: files } = await supabase
            .from("plan_doc_files")
            .select("id, album_id")
            .in("album_id", albumIds);
          const byAlbum = {};
          (files || []).forEach(f => { byAlbum[f.album_id] = (byAlbum[f.album_id] || 0) + 1; });
          (albums || []).forEach(a => { docCount[a.plan_id] = (docCount[a.plan_id] || 0) + (byAlbum[a.id] || 0); });
        }
      } catch { /* optional */ }

      // รายงาน AH
      const ahMap = {};
      try {
        const { data: ah } = await supabase
          .from("ah_farm_reports")
          .select("plan_id, farm_condition, weather, created_at")
          .in("plan_id", planIds)
          .order("created_at", { ascending: false });
        (ah || []).forEach(r => {
          if (!ahMap[r.plan_id]) {
            ahMap[r.plan_id] = { condition: r.farm_condition || null, weather: r.weather || null, at: r.created_at };
          }
        });
      } catch { /* optional */ }

      setRows(plans || []);
      setSessions(sessMap);
      setLatestPos(latestMap);
      setDocCountByPlan(docCount);
      setAhByPlan(ahMap);
    } catch (e) {
      toastErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }, [isAdmin, start, end]);

  useEffect(() => { loadQueues(); }, [loadQueues]);

  /* ETA ต่อ “โรงงานของแผนนั้น ๆ” */
  function calcEtaMin(plan) {
    const pos = latestPos[plan.id];
    const ff = siteToFactory[plan.factory];
    if (!pos || !ff?.lat || !ff?.lng) return null;
    const here = pos;
    const factoryCoord = { lat: ff.lat, lng: ff.lng };
    const distKm = haversineKm(here, factoryCoord);
    const speed = here.speed_kmh && here.speed_kmh > 3 ? here.speed_kmh : 40;
    const min = Math.round((distKm / speed) * 60);
    return Math.max(1, min);
  }

  /* ฟิลเตอร์ค้นหา */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.delivery_date, r.farm_name, r.plant, r.branch, r.house, r.plate, r.factory]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [rows, query]);

  /* ---------- ข้อมูลสำหรับแผนที่รวม ---------- */
  const overviewMarkers = useMemo(() => {
    return filtered
      .map(p => (latestPos[p.id] ? { plan: p, pos: latestPos[p.id] } : null))
      .filter(Boolean);
  }, [filtered, latestPos]);

  const overviewFactoryCoords = useMemo(() => {
    const pts = [];
    filtered.forEach(p => {
      const f = siteToFactory[p.factory];
      if (f?.lat && f?.lng) pts.push({ lat: f.lat, lng: f.lng, name: f.name || f.site });
    });
    // unique by lat,lng
    const seen = new Set();
    return pts.filter(pt => {
      const k = `${pt.lat},${pt.lng}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [filtered, siteToFactory]);

  const allCoords = useMemo(() => {
    const pts = [];
    overviewFactoryCoords.forEach(c => pts.push({ lat: c.lat, lng: c.lng }));
    overviewMarkers.forEach(m => pts.push({ lat: m.pos.lat, lng: m.pos.lng }));
    return pts;
  }, [overviewFactoryCoords, overviewMarkers]);

  /* logout */
  const doLogout = () => {
    try { localStorage.removeItem("user"); } catch {}
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="bg-amber-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin • ดูรถทั้งหมด</h1>
          <div className="flex items-center gap-2">
            {/* ← ปุ่ม Back to Admin ที่เพิ่มเข้ามา */}
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="rounded-md bg-amber-500 text-amber-950 px-4 py-2 font-semibold hover:bg-amber-400 active:bg-amber-500"
            >
              Back to Admin
            </button>
            <button
              type="button"
              onClick={doLogout}
              className="rounded-md bg-amber-300 text-amber-950 px-4 py-2 font-semibold hover:bg-amber-400 active:bg-amber-500"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        {!isAdmin ? (
          <div className="rounded-xl border border-amber-200 bg-white p-6 text-center">
            <div className="text-lg font-semibold text-gray-800">ไม่มีสิทธิ์เข้าถึง</div>
            <div className="text-gray-600 mt-1">หน้านี้สำหรับผู้ดูแลระบบ (Admin) เท่านั้น</div>
            <div className="mt-4">
              <button onClick={() => navigate("/", { replace: true })} className="rounded-md bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">
                กลับหน้าแรก
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Alerts */}
            {err && (
              <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 flex items-center justify-between">
                <span>{err}</span>
                <button className="text-red-700" onClick={() => setErr("")}>×</button>
              </div>
            )}
            {ok && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
                {ok}
              </div>
            )}

            {/* Controls */}
            <div className="rounded-xl border border-amber-200 bg-white p-3 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="space-x-2">
                <Pill color="amber">ช่วง: {fmtDate(start)} → {fmtDate(end)}</Pill>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ค้นหา (วันที่/ฟาร์ม/ทะเบียน/โรงงาน)"
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

            {/* แผนที่รวมทุกโรงงาน + รถทุกคัน */}
            <div className="rounded-xl border border-amber-200 bg-white p-2">
              <div className="px-2 py-1 text-sm text-gray-600">แผนที่รวม (ทุกโรงงาน / ทุกคัน)</div>
              <div className="h-[560px] rounded-lg overflow-hidden border border-amber-200">
                <MapContainer className="h-full w-full" center={[13.736717, 100.523186]} zoom={8} scrollWheelZoom>
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FitBounds coords={allCoords} />

                  {/* ตำแหน่งโรงงานทั้งหมด */}
                  {overviewFactoryCoords.map((f, idx) => (
                    <Marker key={`f-${idx}`} position={[f.lat, f.lng]} icon={iconSmall}>
                      <Tooltip permanent direction="top" offset={[0, -10]}>{f.name || "โรงงาน"}</Tooltip>
                      <Popup>{f.name || "โรงงาน"}</Popup>
                    </Marker>
                  ))}

                  {/* รถทุกคัน */}
                  {overviewMarkers.map(({ plan, pos }) => {
                    const s = sessions[plan.id];
                    const status =
                      s?.completed ? "completed"
                      : s?.arrived_factory_at ? "arrived_factory"
                      : s?.left_farm_at ? "left_farm"
                      : s?.arrived_farm_at ? "at_farm"
                      : "pending";

                    const docs = docCountByPlan[plan.id] || 0;
                    const ah = ahByPlan[plan.id];
                    const etaMin = calcEtaMin(plan);

                    return (
                      <Marker key={plan.id} position={[pos.lat, pos.lng]} icon={iconSmall}>
                        <Tooltip permanent direction="top" offset={[0, -10]}>
                          {plan.factory || "-"} • {plan.plate || "-"} • {status}{etaMin ? ` • ETA ${etaMin}น.` : ""}
                        </Tooltip>
                        <Popup>
                          <div className="font-medium mb-1">{plan.farm_name || "-"}</div>
                          โรงงาน: {siteToFactory[plan.factory]?.name || plan.factory || "-"}<br />
                          ล่าสุด: {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}<br />
                          เวลา: {fmtTime(pos.at)}<br />
                          ทะเบียน: {plan.plate || "-"}<br />
                          เอกสาร: {docs ? `${docs} ไฟล์` : "-"}<br />
                          AH: {ah ? `${clip(ah.condition, 40)} • อากาศ ${ah.weather || "-"}` : "-"}
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            </div>

            {/* ตารางคิวรวม */}
            <div className="space-y-3">
              {busy && <div className="text-gray-500">กำลังโหลด…</div>}
              {!busy && filtered.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-white p-4 text-gray-600">
                  ไม่พบคิวในช่วงเวลา
                </div>
              )}

              {filtered.map((r) => {
                const sess = sessions[r.id];
                const last = latestPos[r.id];
                const etaMin = calcEtaMin(r);
                const isArrived = !!sess?.arrived_factory_at;

                const docs = docCountByPlan[r.id] || 0;
                const ah = ahByPlan[r.id];

                const status =
                  sess?.completed ? "completed"
                  : isArrived ? "arrived_factory"
                  : sess?.left_farm_at ? "left_farm"
                  : sess?.arrived_farm_at ? "at_farm"
                  : "pending";

                return (
                  <div key={r.id} className="rounded-xl border border-amber-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">
                        {r.delivery_date} • {r.plant}/{r.branch}/{r.house} — {r.farm_name || "-"} · รถ {r.plate || "-"} · โรงงาน {siteToFactory[r.factory]?.name || r.factory || "-"}
                      </div>
                      <div className="space-x-2">
                        <Pill color={
                          status === "completed" || status === "arrived_factory" ? "green"
                          : status === "left_farm" ? "blue"
                          : status === "at_farm" ? "amber"
                          : "slate"
                        }>
                          {status}
                        </Pill>
                        {etaMin ? <Pill color="blue">ETA ~ {etaMin} นาที</Pill> : null}
                        {last ? <Pill color="slate">{fmtTime(last.at)}</Pill> : null}
                        <Pill color={docs ? "green" : "slate"}>Docs: {docs || "-"}</Pill>
                        {ah ? <Pill color="amber">AH: {clip(ah.condition, 20)} / {ah.weather || "-"}</Pill> : <Pill>AH: -</Pill>}
                      </div>
                    </div>

                    {/* เวลาอ้างอิง (read-only) */}
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="rounded border border-amber-200 p-2">
                        <div className="text-gray-500">ถึงฟาร์ม (driver)</div>
                        <div className="font-medium">{fmtTime(sess?.arrived_farm_at)}</div>
                      </div>
                      <div className="rounded border border-amber-200 p-2">
                        <div className="text-gray-500">ออกจากฟาร์ม (driver)</div>
                        <div className="font-medium">{fmtTime(sess?.left_farm_at)}</div>
                      </div>
                      <div className="rounded border border-amber-200 p-2">
                        <div className="text-gray-500">ถึงโรงงาน (driver)</div>
                        <div className="font-medium">{fmtTime(sess?.arrived_factory_at)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
