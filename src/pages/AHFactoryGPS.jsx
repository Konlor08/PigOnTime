// src/pages/AHFactoryGPS.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import supabase from "../lib/supabaseClient";
import { Link } from "react-router-dom";

/* ---------- label โรงงาน ---------- */
function factoryLabel(x) {
if (!x) return "";
const code = [x.site, x.branch].filter(Boolean).join(" / ");
const name = x.name ? ` ${x.name}` : "";
return `${code}${name}`.trim();
}

/* ---------- กล่องค้นหา + แถบสีเมื่อเลือก ---------- */
function SearchBox({ list, value, onChange }) {
const [q, setQ] = useState("");
const results = useMemo(() => {
const qq = q.trim().toLowerCase();
if (!qq) return list;
return list.filter((x) =>
[
x.site,
x.branch,
x.name,
x.subdistrict,
x.district,
x.province,
`${x.site}${x.branch}`,
]
.filter(Boolean)
.join(" ")
.toLowerCase()
.includes(qq)
);
}, [q, list]);

return (
<div className="rounded-xl border bg-white/90 p-3">
<input
value={q}
onChange={(e) => setQ(e.target.value)}
placeholder="Search..."
className="mb-2 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
/>
<div className="max-h-80 overflow-auto space-y-2">
{results.map((x) => (
<button
key={x.id}
type="button"
onClick={() => onChange(x.id)}
className={`block w-full text-left rounded-md px-3 py-2 border transition-all
${
value === x.id
? "bg-emerald-100 border-emerald-500 ring-2 ring-emerald-400"
: "hover:bg-emerald-50"
}`}
>
{factoryLabel(x)}
{x.lat != null && x.lng != null && (
<span className="ml-2 text-xs text-emerald-700">(มีพิกัดแล้ว)</span>
)}
</button>
))}
{!results.length && (
<div className="text-center text-gray-500 py-6">ไม่พบข้อมูล</div>
)}
</div>
</div>
);
}

export default function AHFactoryGPS() {
const [loading, setLoading] = useState(false);
const [err, setErr] = useState("");
const [msg, setMsg] = useState("");

const [factories, setFactories] = useState([]);
const [factoryId, setFactoryId] = useState(null);

const [lat, setLat] = useState("");
const [lng, setLng] = useState("");

// เติมค่า lat/lng ให้ input เมื่อเลือกโรงงาน
useEffect(() => {
const f = factories.find((x) => x.id === factoryId);
if (f) {
setLat(f.lat != null ? String(f.lat) : "");
setLng(f.lng != null ? String(f.lng) : "");
} else {
setLat("");
setLng("");
}
}, [factoryId, factories]);

/* ----- โหลดโรงงานทั้งหมด (เพื่อแก้ไขได้) ----- */
const loadFactories = useCallback(async () => {
setErr("");
setLoading(true);
try {
const { data, error } = await supabase
.from("factories")
.select("id, site, branch, name, subdistrict, district, province, lat, lng")
.order("site", { ascending: true });

if (error) throw error;
setFactories(data || []);
} catch (e) {
setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
} finally {
setLoading(false);
}
}, []);

useEffect(() => { loadFactories(); }, [loadFactories]);

/* ----- ดึงตำแหน่งมือถือ ----- */
const getGPS = () => {
setErr("");
if (!("geolocation" in navigator)) {
setErr("อุปกรณ์ไม่รองรับ GPS"); return;
}
navigator.geolocation.getCurrentPosition(
(pos) => {
const { latitude, longitude } = pos.coords;
setLat(latitude.toFixed(6));
setLng(longitude.toFixed(6));
},
(e) => setErr(e.message || "ดึงตำแหน่งไม่สำเร็จ"),
{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
);
};

/* ----- บันทึกลง factories(lat,lng) ----- */
const onSave = async () => {
setErr(""); setMsg("");
if (!factoryId) return setErr("กรุณาเลือกโรงงาน");
if (lat === "" || lng === "") return setErr("กรุณาระบุ lat และ lng");

setLoading(true);
try {
const latNum = Number(lat);
const lngNum = Number(lng);
if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
throw new Error("รูปแบบพิกัดไม่ถูกต้อง");
}
const { error } = await supabase
.from("factories")
.update({ lat: latNum, lng: lngNum })
.eq("id", factoryId);
if (error) throw error;

setMsg("บันทึกสำเร็จ");
setTimeout(() => setMsg(""), 2500);

// sync state ทันที
setFactories((old) =>
old.map((x) => (x.id === factoryId ? { ...x, lat: latNum, lng: lngNum } : x))
);
} catch (e) {
setErr(e.message || "บันทึกไม่สำเร็จ");
} finally {
setLoading(false);
}
};

/* ----- ล้างพิกัด ----- */
const onClear = async () => {
if (!factoryId) return setErr("กรุณาเลือกโรงงาน");
setErr(""); setMsg(""); setLoading(true);
try {
const { error } = await supabase
.from("factories")
.update({ lat: null, lng: null })
.eq("id", factoryId);
if (error) throw error;

setMsg("ล้างพิกัดแล้ว");
setTimeout(() => setMsg(""), 2000);
setFactories((old) =>
old.map((x) => (x.id === factoryId ? { ...x, lat: null, lng: null } : x))
);
setLat(""); setLng("");
} catch (e) {
setErr(e.message || "ล้างพิกัดไม่สำเร็จ");
} finally {
setLoading(false);
}
};

return (
<div className="min-h-screen bg-emerald-50">
<header className="bg-emerald-600 text-white">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<h1 className="text-2xl font-semibold">อัปเดตพิกัดโรงงาน (GPS มือถือ)</h1>
<Link to="/ah" className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20">
กลับหน้า Animal husbandry
</Link>
</div>
</header>

<main className="mx-auto max-w-6xl px-4 py-6">
{err && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{err}</div>}
{msg && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{msg}</div>}

<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
{/* รายการโรงงาน */}
<div className="md:col-span-2">
<div className="font-semibold mb-2">เลือกโรงงาน —</div>
<SearchBox list={factories} value={factoryId} onChange={setFactoryId} />
{loading && <div className="text-gray-500 mt-3">กำลังโหลด…</div>}
{!loading && factories.length === 0 && (
<div className="text-gray-500 mt-3">ไม่มีข้อมูลโรงงาน</div>
)}
</div>

{/* แผงพิกัด */}
<div className="space-y-3">
<div className="rounded-xl border bg-white/90 p-3">
<div className="font-semibold mb-2">พิกัด</div>

<label className="block text-sm text-gray-600 mb-1">Lat</label>
<input
value={lat}
onChange={(e) => setLat(e.target.value)}
placeholder="เช่น 14.123456"
className="mb-3 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
/>

<label className="block text-sm text-gray-600 mb-1">Lng</label>
<input
value={lng}
onChange={(e) => setLng(e.target.value)}
placeholder="เช่น 100.987654"
className="mb-3 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
/>

<div className="flex flex-wrap gap-2">
<button
type="button"
onClick={getGPS}
className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
disabled={loading}
>
ดึงตำแหน่งปัจจุบัน
</button>
<button
type="button"
onClick={onSave}
className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
disabled={loading || !factoryId}
>
บันทึก
</button>
<button
type="button"
onClick={onClear}
className="rounded-md bg-gray-200 px-4 py-2 hover:bg-gray-300 disabled:opacity-60"
disabled={loading || !factoryId}
>
ล้างพิกัด
</button>
</div>

<div className="text-xs text-gray-500 mt-2">
* เลือกโรงงาน → กรอก/ดึง lat,lng → บันทึก หรือกด “ล้างพิกัด”
</div>
</div>
</div>
</div>
</main>
</div>
);
}
