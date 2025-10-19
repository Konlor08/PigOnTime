// src/pages/DriverDesk.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

/* ------- Leaflet ------- */
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon path (Vite) + สร้าง icon 2 ขนาด
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

const iconBig = new L.Icon({
  iconRetinaUrl: ICON_RETINA,
  iconUrl: ICON_STD,
  shadowUrl: ICON_SHADOW,
  iconSize: [38, 60],
  iconAnchor: [19, 60],
  popupAnchor: [1, -40],
  shadowSize: [60, 60],
});

/* ---------- helpers ---------- */
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-");
const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
// แสดง HH:MM สำหรับ time string เช่น "08:30:00"
const hhmm = (t) => (t ? String(t).slice(0,5) : "-");

// Haversine (km)
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

/* ---- Fit map bounds to coordinates ---- */
function FitBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (!coords || coords.length === 0) return;
    const latlngs = coords.map((p) => [p.lat, p.lng]);
    if (latlngs.length === 1) { map.setView(latlngs[0], 15); return; }
    map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
  }, [coords, map]);
  return null;
}

/* ---- 3-day advance guard ---- */
const dayOnly = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const canActFromDate = (planDateISO) => {
  const plan = dayOnly(planDateISO);
  const earliest = new Date(plan); // เริ่มกดได้ตั้งแต่ 3 วันก่อนวันแผน
  earliest.setDate(plan.getDate() - 3);
  return { earliest, todayOk: dayOnly(new Date()) >= earliest };
};

/* ---------- main ---------- */
export default function DriverDesk() {
  const navigate = useNavigate();
  let me = null;
  try { me = JSON.parse(localStorage.getItem("user") || "null"); } catch { me = null; }

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [rows, setRows] = useState([]); // แผน
  const [sessions, setSessions] = useState({}); // plan_id -> session
  const [positionsMap, setPositionsMap] = useState({}); // plan_id -> latest pos
  const [trackCache, setTrackCache] = useState({}); // plan_id -> track

  const [query, setQuery] = useState("");
  const [mapOpen, setMapOpen] = useState({}); // plan_id -> boolean

  const [activePlanId, setActivePlanId] = useState(null); // คิวที่กำลังติดตาม (สำหรับไอคอนใหญ่)

  const start = todayISO();
  const end = plusDaysISO(7);

  // GPS watcher per plan
  const gpsWatcherRef = useRef({}); // plan_id -> watchId

  const toastOk = (m) => { setOk(m); setTimeout(() => setOk(""), 3000); };
  const toastErr = (m) => setErr(m);

  const stopWatch = (plan_id) => {
    const id = gpsWatcherRef.current[plan_id];
    if (id != null) {
      navigator.geolocation.clearWatch(id);
      delete gpsWatcherRef.current[plan_id];
    }
    if (activePlanId === plan_id) setActivePlanId(null);
  };

  const startWatch = (plan_id, session_id) => {
    if (!("geolocation" in navigator)) { toastErr("อุปกรณ์ไม่รองรับ GPS"); return; }
    // กันกดหลายคิวพร้อมกัน: ถ้ามี active ตัวอื่นอยู่ ให้บล็อก
    if (activePlanId && activePlanId !== plan_id) {
      toastErr("กำลังติดตามคิวอื่นอยู่ กรุณาจบคิวเดิมก่อน");
      return;
    }

    stopWatch(plan_id);

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, heading, speed } = pos.coords;
        const snap = {
          lat: latitude,
          lng: longitude,
          heading: heading ?? null,
          speed_kmh: speed != null ? (speed * 3.6) : null,
          at: new Date().toISOString(),
        };

        setPositionsMap((old) => ({ ...old, [plan_id]: snap }));

        setTrackCache((old) => {
          const prev = old[plan_id] || [];
          const last = prev[prev.length - 1];
          if (last) {
            const dist = haversineKm(last, snap) * 1000;
            if (dist < 15) return old;
          }
          return { ...old, [plan_id]: [...prev, snap] };
        });

        try {
          await supabase.from("driver_positions").insert({
            session_id, lat: latitude, lng: longitude, heading: snap.heading, speed_kmh: snap.speed_kmh,
          });
        } catch (e) {
          console.log("driver_positions insert err", e?.message);
        }
      },
      (e) => { toastErr(e.message || "เปิด GPS ไม่สำเร็จ"); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    gpsWatcherRef.current[plan_id] = watchId;
    setActivePlanId(plan_id); // ทำให้ไอคอนคิวนี้ใหญ่
  };

  const loadQueues = useCallback(async () => {
    setErr(""); setBusy(true);
    try {
      if (!me?.id) throw new Error("ไม่พบผู้ใช้ปัจจุบัน");

      // 1) รถของ driver
      const { data: rels, error: e1 } = await supabase
        .from("driver_truck_relations")
        .select("truck_id")
        .eq("idcode", me.id)
        .eq("status", "active");
      if (e1) throw e1;
      const truckIds = (rels || []).map((r) => r.truck_id);
      if (!truckIds.length) { setRows([]); setSessions({}); setBusy(false); return; }

      // 2) ทะเบียนรถ
      const { data: trucks, error: e2 } = await supabase
        .from("trucks")
        .select("id, plate")
        .in("id", truckIds);
      if (e2) throw e2;
      const plates = (trucks || []).map((t) => (t.plate || "").trim()).filter(Boolean);
      const truckMap = Object.fromEntries((trucks || []).map((t) => [String(t.plate || "").trim(), t.id]));

      if (!plates.length) { setRows([]); setSessions({}); setBusy(false); return; }

      // 3) แผนที่เกี่ยวข้อง (วันนี้ -> +7)  **เพิ่ม timetrucktofarm**
      const { data: plans, error: e3 } = await supabase
        .from("planning_plan_full")
        .select("id, delivery_date, delivery_time, timetrucktofarm, plant, branch, house, farm_name, plate, quantity")
        .in("plate", plates)
        .gte("delivery_date", start)
        .lte("delivery_date", end)
        .order("delivery_date", { ascending: true });
      if (e3) throw e3;

      const planIds = (plans || []).map((p) => p.id);

      // 4) session ล่าสุดของแต่ละแผน (ของ driver คนนี้)
      let sessMap = {};
      if (planIds.length) {
        const { data: sess, error: e4 } = await supabase
          .from("driver_trip_sessions")
          .select("*")
          .in("plan_id", planIds)
          .eq("driver_id", me.id)
          .order("created_at", { ascending: false });
        if (e4) throw e4;
        (sess || []).forEach((s) => { if (!sessMap[s.plan_id]) sessMap[s.plan_id] = s; });
      }

      const rowsWithTruck = (plans || []).map((p) => ({ ...p, _truck_id: truckMap[String(p.plate || "").trim()] || null }));

      setRows(rowsWithTruck);
      setSessions(sessMap);
    } catch (e) {
      setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }, [me?.id, start, end]);

  useEffect(() => { loadQueues(); }, [loadQueues]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.delivery_date, r.farm_name, r.plant, r.branch, r.house, r.plate, r.delivery_time, r.timetrucktofarm]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  /* ---------- actions ---------- */
  const ensureSession = async (plan_id, truck_id) => {
    if (sessions[plan_id]) return sessions[plan_id];
    if (!truck_id) throw new Error("ไม่พบข้อมูลรถสำหรับทะเบียนนี้");

    const { data, error } = await supabase
      .from("driver_trip_sessions")
      .insert({ plan_id, driver_id: me.id, truck_id })
      .select("*")
      .single();
    if (error) throw error;

    setSessions((old) => ({ ...old, [plan_id]: data }));
    return data;
  };

  const markArrivedFarm = async (plan) => {
    setErr(""); setBusy(true);
    try {
      // บล็อกถ้ามี active ตัวอื่นอยู่
      if (activePlanId && activePlanId !== plan.id) {
        toastErr("กำลังกดใช้งานคิวอื่นอยู่ กรุณาจบคิวเดิมก่อน");
        return;
      }

      const sess = await ensureSession(plan.id, plan._truck_id);
      const { error } = await supabase
        .from("driver_trip_sessions")
        .update({ arrived_farm_at: new Date().toISOString() })
        .eq("id", sess.id);
      if (error) throw error;

      startWatch(plan.id, sess.id);
      await loadQueues();
      toastOk("บันทึกเวลา 'ถึงฟาร์ม' แล้ว และเริ่มส่งตำแหน่งเรียลไทม์");
    } catch (e) {
      toastErr(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const markLeftFarm = async (plan) => {
    setErr(""); setBusy(true);
    try {
      const sess = sessions[plan.id];
      if (!sess) throw new Error("ยังไม่ได้กด 'ถึงฟาร์ม'");
      const { error } = await supabase
        .from("driver_trip_sessions")
        .update({ left_farm_at: new Date().toISOString() })
        .eq("id", sess.id);
      if (error) throw error;

      await loadQueues();
      toastOk("บันทึกเวลา 'ออกจากฟาร์ม' แล้ว");
    } catch (e) {
      toastErr(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const markArrivedFactory = async (plan) => {
    setErr(""); setBusy(true);
    try {
      const sess = sessions[plan.id];
      if (!sess) throw new Error("ยังไม่ได้กด 'ถึงฟาร์ม'");
      const { error } = await supabase
        .from("driver_trip_sessions")
        .update({ arrived_factory_at: new Date().toISOString(), completed: true })
        .eq("id", sess.id);
      if (error) throw error;

      stopWatch(plan.id);
      await loadQueues();
      toastOk("บันทึกเวลา 'ถึงโรงงาน' แล้ว (คิวเสร็จสมบูรณ์)");
    } catch (e) {
      toastErr(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  // โหลด track จาก DB เมื่อเปิดแผนที่
  const loadTrack = async (plan_id) => {
    const sess = sessions[plan_id];
    if (!sess?.id) return;
    try {
      const { data, error } = await supabase
        .from("driver_positions")
        .select("lat,lng,recorded_at")
        .eq("session_id", sess.id)
        .order("recorded_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      const pts = (data || []).map((p) => ({ lat: p.lat, lng: p.lng, at: p.recorded_at }));
      setTrackCache((old) => ({ ...old, [plan_id]: pts }));
    } catch (e) {
      console.log("loadTrack error", e?.message);
    }
  };

  /* logout */
  const doLogout = () => {
    try { localStorage.removeItem("user"); } catch { /* ignore */ }
    Object.keys(gpsWatcherRef.current || {}).forEach((pid) => stopWatch(pid));
    navigate("/login", { replace: true });
  };

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="bg-amber-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Driver Desk</h1>
          <button
            type="button"
            onClick={doLogout}
            className="rounded-md bg-amber-300 text-amber-950 px-4 py-2 font-semibold hover:bg-amber-400 active:bg-amber-500"
            title="ออกจากระบบ"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Controls */}
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
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

        <div className="rounded-xl border border-amber-200 bg-white p-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="space-x-2">
            <Pill color="amber">วันนี้: {fmtDate(start)}</Pill>
            <Pill>ถึง: {fmtDate(end)}</Pill>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหา (วันที่/ฟาร์ม/plant-branch-house/ทะเบียน/เวลานัด/เวลาเดินรถ)"
            className="rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500 w-80"
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

        {/* Rows */}
        <div className="space-y-3">
          {busy && <div className="text-gray-500">กำลังโหลด…</div>}
          {!busy && filtered.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-white p-4 text-gray-600">
              ไม่พบคิวที่เกี่ยวข้อง
            </div>
          )}

          {filtered.map((r) => {
            const sess = sessions[r.id];
            const startedAt = sess?.arrived_farm_at || sess?.started_at;
            let elapsedMin = "-";
            if (startedAt && !sess?.arrived_factory_at) {
              const ms = Date.now() - new Date(startedAt).getTime();
              elapsedMin = Math.max(1, Math.round(ms / 60000)) + " นาที";
            } else if (sess?.arrived_factory_at) {
              const ms = new Date(sess.arrived_factory_at).getTime() - new Date(startedAt || sess?.started_at).getTime();
              elapsedMin = Math.max(1, Math.round(ms / 60000)) + " นาที";
            }

            const isMapOpen = !!mapOpen[r.id];
            const coords = trackCache[r.id] || [];
            const { earliest, todayOk } = canActFromDate(r.delivery_date);

            // สถานะรถตามกิจกรรม (สำหรับ Tooltip และ Pill)
            const statusLabel = sess?.completed
              ? "completed"
              : sess?.arrived_factory_at
              ? "arrived_factory"
              : sess?.left_farm_at
              ? "left_farm"
              : sess?.arrived_farm_at
              ? "at_farm"
              : "pending";

            // ✅ ตำแหน่งที่ใช้วาง Marker: สด > จุดล่าสุดใน track > ไม่มี
            const lastTrack = coords.length ? coords[coords.length - 1] : null;
            const currentPos = positionsMap[r.id] || lastTrack || null;

            // ✅ สำหรับ FitBounds: ถ้าไม่มี track แต่มี currentPos ให้ใช้ currentPos
            const boundsCoords = coords.length ? coords : (currentPos ? [currentPos] : []);

            return (
              <div key={r.id} className="rounded-xl border border-amber-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {r.delivery_date} • {r.plant}/{r.branch}/{r.house} — {r.farm_name || "-"} · รถ {r.plate || "-"}
                    {" "}
                    • เวลาถึงฟาร์ม {hhmm(r.delivery_time)} • เวลาขึ้นสุกรเสร็จ {r.timetrucktofarm ?? "-"}
                  </div>
                  <div className="space-x-2">
                    <Pill color={
                      statusLabel === "completed" || statusLabel === "arrived_factory" ? "green"
                      : statusLabel === "left_farm" ? "blue"
                      : statusLabel === "at_farm" ? "amber"
                      : "slate"
                    }>
                      {statusLabel}
                    </Pill>
                    {elapsedMin !== "-" && <Pill color="blue">เวลา: {elapsedMin}</Pill>}
                  </div>
                </div>

                {/* Live info */}
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded border border-amber-200 p-2">
                    <div className="text-gray-500">ถึงฟาร์ม</div>
                    <div className="font-medium">{fmtTime(sess?.arrived_farm_at)}</div>
                  </div>
                  <div className="rounded border border-amber-200 p-2">
                    <div className="text-gray-500">ออกจากฟาร์ม</div>
                    <div className="font-medium">{fmtTime(sess?.left_farm_at)}</div>
                  </div>
                  <div className="rounded border border-amber-200 p-2">
                    <div className="text-gray-500">ถึงโรงงาน</div>
                    <div className="font-medium">{fmtTime(sess?.arrived_factory_at)}</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {!sess?.arrived_farm_at && (
                    <button
                      type="button"
                      disabled={busy || !r._truck_id || !todayOk}
                      onClick={() => {
                        if (!todayOk) { toastErr(`ปุ่มกดได้ตั้งแต่ ${fmtDate(earliest)}`); return; }
                        markArrivedFarm(r);
                      }}
                      className="rounded-md bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      ถึงฟาร์ม
                    </button>
                  )}
                  {sess?.arrived_farm_at && !sess?.left_farm_at && (
                    <button
                      type="button"
                      disabled={busy || !todayOk}
                      onClick={() => {
                        if (!todayOk) { toastErr(`ปุ่มกดได้ตั้งแต่ ${fmtDate(earliest)}`); return; }
                        markLeftFarm(r);
                      }}
                      className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      ออกจากฟาร์ม
                    </button>
                  )}
                  {sess?.arrived_farm_at && !sess?.arrived_factory_at && (
                    <button
                      type="button"
                      disabled={busy || !todayOk}
                      onClick={() => {
                        if (!todayOk) { toastErr(`ปุ่มกดได้ตั้งแต่ ${fmtDate(earliest)}`); return; }
                        markArrivedFactory(r);
                      }}
                      className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      ถึงโรงงาน (จบคิว)
                    </button>
                  )}

                  {/* Toggle Map */}
                  <button
                    type="button"
                    onClick={async () => {
                      const next = !isMapOpen;
                      setMapOpen((old) => ({ ...old, [r.id]: next }));
                      if (next) await loadTrack(r.id);
                    }}
                    className="rounded-md border border-amber-300 px-4 py-2 hover:bg-amber-50"
                  >
                    {isMapOpen ? "ซ่อนแผนที่" : "แสดงแผนที่"}
                  </button>
                </div>

                {/* Map (toggle) */}
                {isMapOpen && (
                  <div className="mt-3 h-80 rounded-lg overflow-hidden border border-amber-200">
                    <MapContainer className="h-full w-full" center={[13.736717, 100.523186]} zoom={12} scrollWheelZoom>
                      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {boundsCoords.length > 0 && ( // ✅ ใช้ boundsCoords
                        <>
                          <FitBounds coords={boundsCoords} />
                          {coords.length > 0 && (
                            <Polyline positions={coords.map((p) => [p.lat, p.lng])} pathOptions={{ weight: 4 }} />
                          )}
                        </>
                      )}
                      {currentPos && ( // ✅ วาง Marker เสมอ: สดหรือจุดล่าสุด
                        <Marker
                          position={[currentPos.lat, currentPos.lng]}
                          icon={activePlanId === r.id ? iconBig : iconSmall}
                        >
                          {/* Tooltip ถาวร: ทะเบียน + สถานะ + เวลานัด */}
                          <Tooltip permanent direction="top" offset={[0, -10]}>
                            รถ {r.plate || "-"} • {statusLabel} • เวลาถึงฟาร์ม {hhmm(r.delivery_time)}
                          </Tooltip>
                          <Popup>
                            ล่าสุด: {currentPos.lat.toFixed(6)}, {currentPos.lng.toFixed(6)}<br />
                            เวลา: {fmtTime(currentPos.at)}
                          </Popup>
                        </Marker>
                      )}
                    </MapContainer>
                  </div>
                )}

                <div className="mt-2 text-xs text-gray-500">
                  * ระบบจะเริ่มส่งพิกัดหลังจากกด "ถึงฟาร์ม" และหยุดเมื่อ "ถึงโรงงาน"
                </div>
                {!todayOk && (
                  <div className="mt-1 text-xs text-amber-700">
                    * ปุ่มจะกดได้ตั้งแต่ {fmtDate(earliest)} (ไม่เกิน 3 วันล่วงหน้าก่อนวันแผน)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
