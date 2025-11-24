// src/pages/AHTransportTracking.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

/* ---------- Leaflet marker icon ---------- */
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

/* ---------- main: AH Transport Tracking ---------- */
export default function AHTransportTracking() {
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
  const [info, setInfo] = useState("");

  const [rows, setRows] = useState([]); // แผนในช่วงที่เกี่ยวข้อง
  const [sessions, setSessions] = useState({}); // plan_id -> session ล่าสุด
  const [latestPos, setLatestPos] = useState({}); // plan_id -> {lat,lng,at,speed_kmh}

  const [query, setQuery] = useState("");

  const [, setFactories] = useState([]); // list โรงงาน (เก็บเผื่อใช้)
  const [factoryBySite, setFactoryBySite] = useState({}); // site -> {name, lat, lng}

  const [issueCountByPlan, setIssueCountByPlan] = useState({}); // plan_id -> count

  const start = todayISO();
  const end = plusDaysISO(7);

  const toastErr = (m) => setErr(m || "");
  const toastInfo = (m) => setInfo(m || "");

  /* โหลดโรงงาน (site->name/coords) เหมือนหน้าอื่น ๆ */
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
      console.log("loadFactories:", e?.message);
    }
  }, []);

  useEffect(() => {
    loadFactories();
  }, [loadFactories]);

  /* โหลดคิว + session + ตำแหน่งล่าสุด + issues
     *** จุดสำคัญของ AH = filter แผนจากฟาร์มที่ AH ผูกอยู่จริง ๆ ***

     สมมุติตารางสิทธิ์ชื่อ ah_farm_relations มีคอลัมน์:
       - ah_id  (user.id ของ AH)
       - farm_id
       - status = 'active'

     ถ้าชื่อตาราง/คอลัมน์ไม่ตรง ให้แก้ตรงนี้จุดเดียว
  */
  const loadQueues = useCallback(async () => {
    setErr("");
    setInfo("");
    setBusy(true);

    try {
      if (!meId) throw new Error("ไม่พบผู้ใช้ปัจจุบัน (AH)");

      // 1) หา farm_id ที่ AH คนนี้รับผิดชอบ
      const { data: rels, error: relErr } = await supabase
        .from("ah_farm_relations") // <-- แก้ชื่อตารางได้
        .select("farm_id, status")
        .eq("ah_id", meId)
        .eq("status", "active");

      if (relErr) throw relErr;

      const farmIds = (rels || [])
        .map((r) => r.farm_id)
        .filter((x) => x != null);

      if (!farmIds.length) {
        toastInfo(
          "คุณยังไม่ได้ผูกสิทธิ์กับฟาร์มหรือโรงงานใด ๆ กรุณาติดต่อผู้ดูแลระบบ"
        );
        setRows([]);
        setSessions({});
        setLatestPos({});
        setIssueCountByPlan({});
        return;
      }

      // 2) แผนในช่วงวันที่ ที่ฟาร์มอยู่ในรายการ farmIds
      let q = supabase
        .from("planning_plan_full")
        .select(
          "id, delivery_date, delivery_time, plant, branch, house, farm_id, farm_name, plate, factory, quantity, timetrucktofarm"
        )
        .gte("delivery_date", start)
        .lte("delivery_date", end)
        .in("farm_id", farmIds) // <-- filter ตามฟาร์มของ AH
        .order("delivery_date", { ascending: true });

      const { data: plans, error: plansErr } = await q;
      if (plansErr) throw plansErr;

      const planIds = (plans || []).map((p) => p.id);

      // 3) session ล่าสุดของแต่ละแผน
      let sessMap = {};
      if (planIds.length) {
        const { data: sess, error: sessErr } = await supabase
          .from("driver_trip_sessions")
          .select(
            "id, plan_id, driver_id, truck_id, arrived_farm_at, left_farm_at, arrived_factory_at, completed, created_at"
          )
          .in("plan_id", planIds)
          .order("created_at", { ascending: false });

        if (sessErr) throw sessErr;
        (sess || []).forEach((s) => {
          if (!sessMap[s.plan_id]) sessMap[s.plan_id] = s;
        });
      }

      // 4) ตำแหน่งล่าสุดของแต่ละ session
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

      // 5) นับจำนวน issues ต่อแผน
      const issueCount = {};
      if (planIds.length) {
        const { data: iss, error: issErr } = await supabase
          .from("plan_issues")
          .select("id, plan_id")
          .in("plan_id", planIds);
        if (!issErr) {
          (iss || []).forEach((x) => {
            issueCount[x.plan_id] = (issueCount[x.plan_id] || 0) + 1;
          });
        }
      }

      setRows(plans || []);
      setSessions(sessMap);
      setLatestPos(latestMap);
      setIssueCountByPlan(issueCount);
    } catch (e) {
      toastErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }, [meId, start, end]);

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

  /* ฟิลเตอร์ค้นหาในตาราง */
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

  /* สำหรับแผนที่รวม */
  const overviewMarkers = useMemo(() => {
    return filtered
      .map((p) => (latestPos[p.id] ? { plan: p, pos: latestPos[p.id] } : null))
      .filter(Boolean);
  }, [filtered, latestPos]);

  const overviewCoords = useMemo(() => {
    const pts = [];
    overviewMarkers.forEach((m) =>
      pts.push({ lat: m.pos.lat, lng: m.pos.lng })
    );
    filtered.forEach((p) => {
      const fac = factoryBySite[p.factory];
      if (fac?.lat && fac?.lng) pts.push({ lat: fac.lat, lng: fac.lng });
    });
    return pts;
  }, [overviewMarkers, filtered, factoryBySite]);

  /* logout + กลับ AH Home */
  const handleLogout = () => {
    try {
      localStorage.removeItem("user");
    } catch {}
    navigate("/login", { replace: true });
  };

  const goAHHome = () => {
    navigate("/ah");
  };

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="bg-amber-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            สถานะการขนส่ง (Transport Tracking)
          </h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={goAHHome}
              className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20"
            >
              กลับหน้า AH Home
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 space-y-4">
        {/* ข้อความ error / info */}
        {err && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 flex items-center justify-between">
            <span>{err}</span>
            <button className="text-rose-700" onClick={() => setErr("")}>
              ×
            </button>
          </div>
        )}
        {info && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
            {info}
          </div>
        )}

        {/* แถบควบคุมบน */}
        <div className="rounded-xl border border-amber-200 bg-white p-3 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="space-x-2">
              <Pill color="green">
                ช่วง: {fmtDate(start)} → {fmtDate(end)}
              </Pill>
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
        </div>

        {/* แผนที่รวม */}
        <div className="rounded-xl border border-amber-200 bg-white p-2">
          <div className="px-2 py-1 text-sm text-gray-600">
            แผนที่แสดงตำแหน่ง ฟาร์ม / โรงงาน / รถขนส่ง (เฉพาะที่คุณเกี่ยวข้อง)
          </div>
          <div className="h-[520px] rounded-lg overflow-hidden border border-amber-200">
            <MapContainer
              className="h-full w-full"
              center={[13.736717, 100.523186]}
              zoom={7}
              scrollWheelZoom
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds coords={overviewCoords} />

              {/* ปลายทางโรงงาน */}
              {filtered.map((p) => {
                const fac = factoryBySite[p.factory];
                if (!fac?.lat || !fac?.lng) return null;
                return (
                  <Marker
                    key={`fac-${p.id}`}
                    position={[fac.lat, fac.lng]}
                    icon={iconSmall}
                  >
                    <Tooltip permanent direction="top" offset={[0, -10]}>
                      โรงงาน: {fac.name}
                    </Tooltip>
                    <Popup>
                      โรงงานปลายทาง: {fac.name}
                      <br />
                      ฟาร์ม: {p.farm_name || "-"}
                      <br />
                      วันที่ส่ง: {p.delivery_date}
                    </Popup>
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
                  factoryBySite[plan.factory]?.name || plan.factory || "-";
                const issues = issueCountByPlan[plan.id] || 0;
                const etaMin = calcEtaMin(plan);

                return (
                  <Marker
                    key={plan.id}
                    position={[pos.lat, pos.lng]}
                    icon={iconSmall}
                  >
                    <Tooltip permanent direction="top" offset={[0, -10]}>
                      รถ {plan.plate || "-"} • {status} • ไป {facName}
                      {etaMin ? ` • ETA ${etaMin}น.` : ""}
                      {issues ? ` • issues ${issues}` : ""}
                    </Tooltip>
                    <Popup>
                      <div className="font-medium mb-1">
                        {plan.farm_name || "-"}
                      </div>
                      ล่าสุด: {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
                      <br />
                      เวลา: {fmtTime(pos.at)}
                      <br />
                      ทะเบียน: {plan.plate || "-"}
                      <br />
                      ปลายทาง: {facName}
                      <br />
                      ปัญหา (issues): {issues || "-"}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* ตารางคิวด้านล่าง (optionally ซ่อน / แก้ได้เอง) */}
        <div className="space-y-3 pb-6">
          {busy && <div className="text-gray-500">กำลังโหลด…</div>}
          {!busy && filtered.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-white p-4 text-gray-600">
              ขณะนี้ยังไม่มีคิวที่อยู่ระหว่างขนส่งสำหรับฟาร์มที่คุณรับผิดชอบ
            </div>
          )}

          {filtered.map((r) => {
            const sess = sessions[r.id];
            const last = latestPos[r.id];
            const etaMin = calcEtaMin(r);
            const facName =
              factoryBySite[r.factory]?.name || r.factory || "-";
            const issues = issueCountByPlan[r.id] || 0;

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
              <div
                key={r.id}
                className="rounded-xl border border-amber-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {r.delivery_date} • {r.plant}/{r.branch}/{r.house} —{" "}
                    {r.farm_name || "-"} · รถ {r.plate || "-"} · ไป {facName}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                    {etaMin ? (
                      <Pill color="blue">ETA ~ {etaMin} นาที</Pill>
                    ) : null}
                    {last ? (
                      <Pill color="slate">{fmtTime(last.at)}</Pill>
                    ) : null}
                    <Pill color={issues ? "amber" : "slate"}>
                      Issues: {issues || "-"}
                    </Pill>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded border border-amber-200 p-2">
                    <div className="text-gray-500">ถึงฟาร์ม (driver)</div>
                    <div className="font-medium">
                      {fmtTime(sess?.arrived_farm_at)}
                    </div>
                  </div>
                  <div className="rounded border border-amber-200 p-2">
                    <div className="text-gray-500">
                      ออกจากฟาร์ม (driver)
                    </div>
                    <div className="font-medium">
                      {fmtTime(sess?.left_farm_at)}
                    </div>
                  </div>
                  <div className="rounded border border-amber-200 p-2">
                    <div className="text-gray-500">
                      ถึงโรงงาน (driver)
                    </div>
                    <div className="font-medium">
                      {fmtTime(sess?.arrived_factory_at)}
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
