// src/pages/FactoryDesk.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";

/* Leaflet */
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* Fix Leaflet marker assets (Vite) + icon */
const ICON_RETINA =
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const ICON_STD =
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const ICON_SHADOW =
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";
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
  new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const fmtTime = (d) =>
  d
    ? new Date(d).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const todayISO = () => new Date().toISOString().slice(0, 10);

const plusDaysISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function haversineKm(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
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
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs ${map[color]}`}
    >
      {children}
    </span>
  );
}

function FitBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    const pts = coords || [];
    if (pts.length === 0) return;
    const ll = pts.map((p) => [p.lat, p.lng]);
    if (ll.length === 1) {
      map.setView(ll[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(ll).pad(0.2));
  }, [coords, map]);
  return null;
}

/* ---------- main (Factory Desk) ---------- */
export default function FactoryDesk() {
  const navigate = useNavigate();

  // session (อ่านจาก localStorage)
  let me = null;
  try {
    me = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    me = null;
  }
  const meId = me?.id || null;

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // site ที่ user โรงงานมีสิทธิ์ดู
  const [mySites, setMySites] = useState([]);
  const [selectedSite, setSelectedSite] = useState("");

  const [rows, setRows] = useState([]); // แผน
  const [sessions, setSessions] = useState({}); // plan_id -> session ล่าสุด
  const [latestPos, setLatestPos] = useState({}); // plan_id -> {lat,lng,at,speed_kmh}
  const [query, setQuery] = useState("");

  const [factories, setFactories] = useState([]);
  const [factoryBySite, setFactoryBySite] = useState({});

  // ฟอร์มบันทึกผลโรงงาน: plan_id -> {arrivedAt: '2025-11-24T10:30', pigQty: '100'}
  const [editValues, setEditValues] = useState({});

  const start = todayISO();
  const end = plusDaysISO(7);

  const toastOk = (m) => {
    setOk(m);
    setTimeout(() => setOk(""), 3000);
  };
  const toastErr = (m) => setErr(m);

  /* โหลด site ที่ user โรงงานมีสิทธิ์ */
  const loadMySites = useCallback(async () => {
    if (!meId) {
      setMySites([]);
      return;
    }
    try {
      // ปรับชื่อ table/column ให้ตรง DB จริง ถ้าใช้ชื่ออื่น
      const { data, error } = await supabase
        .from("factory_site_relations")
        .select("site")
        .eq("user_id", meId)
        .eq("status", "active");

      if (error) throw error;
      setMySites((data || []).map((r) => r.site).filter(Boolean));
    } catch (e) {
      console.log("loadMySites:", e.message);
      setMySites([]);
    }
  }, [meId]);

  /* โหลดโรงงานทั้งหมด (ไว้ map ชื่อ/พิกัด + dropdown) */
  const loadFactories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("factories")
        .select("id, site, name, lat, lng");
      if (error) throw error;
      setFactories(data || []);
      const map = Object.fromEntries(
        (data || []).map((f) => [
          f.site,
          { name: f.name || f.site, lat: f.lat, lng: f.lng },
        ])
      );
      setFactoryBySite(map);
    } catch (e) {
      console.log("loadFactories:", e.message);
    }
  }, []);

  useEffect(() => {
    loadMySites();
  }, [loadMySites]);

  useEffect(() => {
    loadFactories();
  }, [loadFactories]);

  const sites = useMemo(() => {
    const allSites = Array.from(
      new Set((factories || []).map((f) => f.site).filter(Boolean))
    );
    if (!mySites.length) return allSites;
    return allSites.filter((s) => mySites.includes(s));
  }, [factories, mySites]);

  /* โหลดคิว / สถานะ / พิกัด ล่าสุด */
  const loadQueues = useCallback(async () => {
    setErr("");
    setBusy(true);
    try {
      if (!meId) throw new Error("ไม่พบผู้ใช้ปัจจุบัน");

      let q = supabase
        .from("planning_plan_full")
        .select(
          "id, delivery_date, delivery_time, plant, branch, house, farm_id, farm_name, plate, factory, quantity, timetrucktofarm"
        )
        .gte("delivery_date", start)
        .lte("delivery_date", end)
        .order("delivery_date", { ascending: true });

      // กรองตาม site ที่ user โรงงานมีสิทธิ์
      if (mySites.length) q = q.in("factory", mySites);
      // และตาม dropdown ถ้าเลือกเพิ่ม
      if (selectedSite) q = q.eq("factory", selectedSite);

      const { data: plans, error: ePlans } = await q;
      if (ePlans) throw ePlans;

      const planIds = (plans || []).map((p) => p.id);

      // session ล่าสุดของแต่ละแผน
      let sessMap = {};
      if (planIds.length) {
        const { data: sess, error: e2 } = await supabase
          .from("driver_trip_sessions")
          .select(
            "id,plan_id,driver_id,truck_id,arrived_farm_at,left_farm_at,arrived_factory_at,completed,pig_qty,created_at"
          )
          .in("plan_id", planIds)
          .order("created_at", { ascending: false });

        if (e2) throw e2;
        (sess || []).forEach((s) => {
          if (!sessMap[s.plan_id]) sessMap[s.plan_id] = s;
        });
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
        if (pos) {
          latestMap[s.plan_id] = {
            lat: pos.lat,
            lng: pos.lng,
            at: pos.recorded_at,
            speed_kmh: pos.speed_kmh ?? null,
          };
        }
      }

      // เตรียมค่า default ให้ฟอร์ม (ถ้ามีค่าเก่าอยู่แล้ว)
      const newEditValues = {};
      (plans || []).forEach((p) => {
        const s = sessMap[p.id];
        if (!s) return;
        newEditValues[p.id] = {
          arrivedAt: s.arrived_factory_at
            ? s.arrived_factory_at.slice(0, 16) // yyyy-MM-ddTHH:mm
            : "",
          pigQty:
            typeof s.pig_qty === "number" && !Number.isNaN(s.pig_qty)
              ? String(s.pig_qty)
              : "",
        };
      });

      setRows(plans || []);
      setSessions(sessMap);
      setLatestPos(latestMap);
      setEditValues((prev) => ({ ...prev, ...newEditValues }));
      toastOk("โหลดข้อมูลคิวโรงงานแล้ว");
    } catch (e) {
      toastErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }, [meId, mySites, selectedSite, start, end]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  /* ETA: จากตำแหน่งล่าสุด → โรงงาน */
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
      [
        r.delivery_date,
        r.farm_name,
        r.plant,
        r.branch,
        r.house,
        r.plate,
        r.factory,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  /* สำหรับ map รวม */
  const overviewMarkers = useMemo(() => {
    return filtered
      .map((p) =>
        latestPos[p.id] ? { plan: p, pos: latestPos[p.id] } : null
      )
      .filter(Boolean);
  }, [filtered, latestPos]);

  const overviewCoords = useMemo(() => {
    const pts = [];
    overviewMarkers.forEach((m) =>
      pts.push({ lat: m.pos.lat, lng: m.pos.lng })
    );
    filtered.forEach((p) => {
      const fac = factoryBySite[p.factory];
      if (fac?.lat && fac?.lng)
        pts.push({ lat: fac.lat, lng: fac.lng });
    });
    return pts;
  }, [overviewMarkers, filtered, factoryBySite]);

  /* logout */
  const doLogout = () => {
    try {
      localStorage.removeItem("user");
    } catch {
      /* noop */
    }
    navigate("/login", { replace: true });
  };

  /* จัดการแก้ฟอร์ม */
  const handleEditChange = (planId, field, value) => {
    setEditValues((prev) => ({
      ...prev,
      [planId]: { ...(prev[planId] || {}), [field]: value },
    }));
  };

  /* บันทึกผลโรงงาน: เวลา + จำนวนสุกร + ปิดคิว */
  const handleSaveFactoryResult = async (planId) => {
    const sess = sessions[planId];
    if (!sess) {
      toastErr("ไม่พบ session ของคิวนี้");
      return;
    }
    const v = editValues[planId] || {};
    const arrivedAtStr = v.arrivedAt || "";
    const pigQtyStr = v.pigQty || "";

    const pigQty = Number(pigQtyStr);
    if (!arrivedAtStr || !pigQtyStr || Number.isNaN(pigQty)) {
      toastErr("กรุณากรอกเวลาและจำนวนสุกรให้ครบถ้วน");
      return;
    }

    const arrivedAtIso = new Date(arrivedAtStr).toISOString();

    setBusy(true);
    try {
      // ปรับชื่อคอลัมน์ถ้า DB จริงใช้ชื่ออื่น
      const { error } = await supabase
        .from("driver_trip_sessions")
        .update({
          arrived_factory_at: arrivedAtIso,
          completed: true, // ปิดคิว
          pig_qty: pigQty,
        })
        .eq("id", sess.id);

      if (error) throw error;

      // อัปเดต state ฝั่งหน้าเว็บ
      setSessions((prev) => ({
        ...prev,
        [planId]: {
          ...(prev[planId] || {}),
          arrived_factory_at: arrivedAtIso,
          completed: true,
          pig_qty: pigQty,
        },
      }));

      toastOk("บันทึกข้อมูลโรงงานเรียบร้อยแล้ว");
    } catch (e) {
      toastErr(e.message || "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-sky-50">
      {/* Header */}
      <header className="bg-sky-700 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            Factory Desk — รับสุกรเข้าโรงงาน
          </h1>
          <button
            type="button"
            onClick={doLogout}
            className="rounded-md bg-sky-200 text-sky-900 px-4 py-2 font-semibold hover:bg-sky-300 active:bg-sky-400"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {/* Alerts */}
        {err && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 flex items-center justify-between">
            <span>{err}</span>
            <button
              className="text-rose-700"
              onClick={() => setErr("")}
            >
              ×
            </button>
          </div>
        )}
        {ok && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2">
            {ok}
          </div>
        )}

        {/* Controls */}
        <div className="rounded-xl border border-sky-200 bg-white p-3 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex flex-wrap items-end gap-3">
              <Pill color="green">
                ช่วง: {fmtDate(start)} → {fmtDate(end)}
              </Pill>

              {/* กรองตาม Site ที่มีสิทธิ์ */}
              <div className="w-64">
                <div className="text-sm text-gray-600 mb-1">
                  กรองตาม Site (โรงงานของคุณ)
                </div>
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">— ทุก Site ที่มีสิทธิ์ —</option>
                  {sites.map((s) => (
                    <option key={s} value={s}>
                      {factoryBySite[s]?.name || s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหา (วันที่/ฟาร์ม/ทะเบียน/โรงงาน)"
                className="rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500 w-72"
              />
              <button
                type="button"
                onClick={loadQueues}
                className="rounded-md bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:opacity-60"
                disabled={busy}
              >
                รีเฟรช
              </button>
            </div>
          </div>
        </div>

        {/* แผนที่รวม */}
        <div className="rounded-xl border border-sky-200 bg-white p-2">
          <div className="px-2 py-1 text-sm text-gray-600">
            แผนที่รวมรถขนส่ง (เฉพาะ Site โรงงานที่คุณรับผิดชอบ)
          </div>
          <div className="h-[520px] rounded-lg overflow-hidden border border-sky-200">
            <MapContainer
              className="h-full w-full"
              center={[13.736717, 100.523186]}
              zoom={12}
              scrollWheelZoom
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds coords={overviewCoords} />

              {/* ตำแหน่งโรงงาน */}
              {filtered.map((p) => {
                const fac = factoryBySite[p.factory];
                if (!fac?.lat || !fac?.lng) return null;
                return (
                  <Marker
                    key={`fac-${p.id}`}
                    position={[fac.lat, fac.lng]}
                    icon={iconSmall}
                  >
                    <Tooltip
                      permanent
                      direction="top"
                      offset={[0, -10]}
                    >
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

                const facName =
                  factoryBySite[plan.factory]?.name ||
                  plan.factory ||
                  "-";
                const etaMin = calcEtaMin(plan);

                return (
                  <Marker
                    key={plan.id}
                    position={[pos.lat, pos.lng]}
                    icon={iconSmall}
                  >
                    <Tooltip
                      permanent
                      direction="top"
                      offset={[0, -10]}
                    >
                      รถ {plan.plate || "-"} • {status} • ไป{" "}
                      {facName}
                      {etaMin ? ` • ETA ${etaMin}น.` : ""}
                    </Tooltip>
                    <Popup>
                      <div className="font-medium mb-1">
                        {plan.farm_name || "-"}
                      </div>
                      ล่าสุด: {pos.lat.toFixed(6)},{" "}
                      {pos.lng.toFixed(6)}
                      <br />
                      เวลา: {fmtTime(pos.at)}
                      <br />
                      ทะเบียน: {plan.plate || "-"}
                      <br />
                      ปลายทาง: {facName}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* ตารางคิว + ฟอร์มบันทึกผลโรงงาน */}
        <div className="space-y-3">
          {busy && (
            <div className="text-gray-500">กำลังโหลด…</div>
          )}
          {!busy && filtered.length === 0 && (
            <div className="rounded-lg border border-sky-200 bg-white p-4 text-gray-600">
              ไม่พบคิวในช่วงเวลานี้
            </div>
          )}

          {filtered.map((r) => {
            const sess = sessions[r.id];
            const last = latestPos[r.id];
            const etaMin = calcEtaMin(r);
            const facName =
              factoryBySite[r.factory]?.name ||
              r.factory ||
              "-";

            const status = sess?.completed
              ? "completed"
              : sess?.arrived_factory_at
              ? "arrived_factory"
              : sess?.left_farm_at
              ? "left_farm"
              : sess?.arrived_farm_at
              ? "at_farm"
              : "pending";

            const edit = editValues[r.id] || {
              arrivedAt: "",
              pigQty: "",
            };

            return (
              <div
                key={r.id}
                className="rounded-xl border border-sky-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {r.delivery_date} • {r.plant}/{r.branch}/
                    {r.house} — {r.farm_name || "-"} · รถ{" "}
                    {r.plate || "-"} · ไป {facName}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill
                      color={
                        status === "completed" ||
                        status === "arrived_factory"
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
                    {etaMin ? (
                      <Pill color="blue">
                        ETA ~ {etaMin} นาที
                      </Pill>
                    ) : null}
                    {last ? (
                      <Pill color="slate">
                        {fmtTime(last.at)}
                      </Pill>
                    ) : null}
                  </div>
                </div>

                {/* เวลาอีเวนต์จาก driver */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded border border-sky-200 p-2">
                    <div className="text-gray-500">
                      ถึงฟาร์ม (driver)
                    </div>
                    <div className="font-medium">
                      {fmtTime(sess?.arrived_farm_at)}
                    </div>
                  </div>
                  <div className="rounded border border-sky-200 p-2">
                    <div className="text-gray-500">
                      ออกจากฟาร์ม (driver)
                    </div>
                    <div className="font-medium">
                      {fmtTime(sess?.left_farm_at)}
                    </div>
                  </div>
                  <div className="rounded border border-sky-200 p-2">
                    <div className="text-gray-500">
                      ถึงโรงงาน (driver)
                    </div>
                    <div className="font-medium">
                      {fmtTime(sess?.arrived_factory_at)}
                    </div>
                  </div>
                </div>

                {/* ฟอร์มบันทึกผลโรงงาน */}
                <div className="mt-4 border-t border-dashed border-sky-100 pt-3 text-sm">
                  <div className="font-semibold mb-2">
                    บันทึกผลรับสุกรเข้าโรงงาน (Factory)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        เวลา “รถถึงโรงงานจริง” (Factory)
                      </label>
                      <input
                        type="datetime-local"
                        value={edit.arrivedAt}
                        onChange={(e) =>
                          handleEditChange(
                            r.id,
                            "arrivedAt",
                            e.target.value
                          )
                        }
                        className="w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        จำนวนสุกรที่รับจริง (ตัว)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={edit.pigQty}
                        onChange={(e) =>
                          handleEditChange(
                            r.id,
                            "pigQty",
                            e.target.value
                          )
                        }
                        className="w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveFactoryResult(r.id)
                        }
                        className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-semibold hover:bg-sky-700 disabled:opacity-60"
                        disabled={busy}
                      >
                        บันทึก & ปิดคิว
                      </button>
                      {sess?.completed && (
                        <span className="self-center text-xs text-emerald-700">
                          คิวนี้ถูกปิดแล้ว
                        </span>
                      )}
                    </div>
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

