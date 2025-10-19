// src/pages/AHFarmGPS.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import supabase from "../lib/supabaseClient";
import { Link } from "react-router-dom";

/* ---------- utils (label แสดงฟาร์ม) ---------- */
function farmLabel(x) {
if (!x) return "";
const code = [x.plant, x.branch, x.house].filter(Boolean).join(" / ");
return `${code} ${x.farm_name || ""}`.trim();
}

/* ---------- กล่องค้นหา/เลือก ---------- */
function SearchBox({ list, value, onChange }) {
const [q, setQ] = useState("");

const results = useMemo(() => {
const qq = q.trim().toLowerCase();
if (!qq) return list;
return list.filter((x) =>
[
x.plant,
x.branch,
x.house,
x.farm_name,
`${x.plant}${x.branch}${x.house}`,
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
className={`block w-full text-left rounded-md px-3 py-2 border ${
value === x.id 
           ? "bg-emerald-100 border-emerald-500 ring-emerald-400" : 
            "hoover: bg-emerald-50 " 

}`}
>
{farmLabel(x)}
</button>
))}
{!results.length && (
<div className="text-center text-gray-500 py-6">ไม่พบข้อมูล</div>
)}
</div>
</div>
);
}

/* ---------- หน้า GPS ---------- */
export default function AHFarmGPS() {
// session (อ่านจาก localStorage — ต้องเป็น role AH)
let me = null;
try {
me = JSON.parse(localStorage.getItem("user") || "null");
} catch {
me = null;
}

/* ----- state ----- */
const [loading, setLoading] = useState(false);
const [err, setErr] = useState("");
const [msg, setMsg] = useState("");

const [farms, setFarms] = useState([]); // รายการฟาร์มที่ยังไม่กำหนดพิกัด
const [farmId, setFarmId] = useState(null);

const [lat, setLat] = useState("");
const [long, setLong] = useState("");

/* ----- โหลดฟาร์มของ AH และกรองเฉพาะที่ยังไม่มีพิกัด ----- */
const loadFarms = useCallback(async () => {
setErr("");
setLoading(true);
try {
if (!me?.id) throw new Error("ไม่พบผู้ใช้ปัจจุบัน");

// ดึงจากความสัมพันธ์ ah_farm_relations -> farms
const { data, error } = await supabase
.from("ah_farm_relations")
.select(
`
farm_id,
farms (
id, plant, house, branch, farm_name, lat, long
)
`
)
.eq("ah_id", me.id);

if (error) throw error;

// แปลง + กรองเฉพาะที่ยัง "ไม่มีพิกัดครบ"
const items = (data || [])
.map((r) => r.farms)
.filter(Boolean)
.filter((f) => f.lat == null || f.long == null);

setFarms(items);
} catch (e) {
setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
} finally {
setLoading(false);
}
}, [me?.id]);

useEffect(() => {
loadFarms();
}, [loadFarms]);

/* ----- ดึงตำแหน่งปัจจุบันจากมือถือ ----- */
const getGPS = async () => {
setErr("");
if (!("geolocation" in navigator)) {
setErr("อุปกรณ์ไม่รองรับ GPS");
return;
}
navigator.geolocation.getCurrentPosition(
(pos) => {
const { latitude, longitude } = pos.coords;
setLat(latitude.toFixed(6));
setLong(longitude.toFixed(6));
},
(e) => setErr(e.message || "ดึงตำแหน่งไม่สำเร็จ"),
{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
);
};

/* ----- บันทึกลง DB (คอลัมน์ชื่อ "long") ----- */
const onSave = async () => {
setErr("");
setMsg("");

if (!farmId) return setErr("กรุณาเลือกฟาร์ม");
if (!lat || !long) return setErr("กรุณาดึงตำแหน่งก่อนบันทึก");

setLoading(true);
try {
const latNum = Number(lat);
const longNum = Number(long);
if (Number.isNaN(latNum) || Number.isNaN(longNum)) {
throw new Error("รูปแบบพิกัดไม่ถูกต้อง");
}

const { error } = await supabase
.from("farms")
.update({ lat: latNum, long: longNum })
.eq("id", farmId);

if (error) throw error;

// แสดงผลสำเร็จ 3 วินาที จากนั้นเคลียร์ค่าและรีโหลด list
setMsg("บันทึกสำเร็จ");
setTimeout(() => setMsg(""), 3000);

// เอาฟาร์มออกจาก list (เพราะตั้งพิกัดแล้ว)
setFarms((old) => old.filter((x) => x.id !== farmId));
setFarmId(null);
setLat("");
setLong("");
} catch (e) {
setErr(e.message || "บันทึกไม่สำเร็จ");
// กรณี error ให้ค้างข้อความไว้จนกว่าผู้ใช้จะแก้/ยกเลิกเอง (ไม่เคลียร์)
} finally {
setLoading(false);
}
};

/* ----- UI ----- */
return (
<div className="min-h-screen bg-emerald-50">
{/* Header โทน AH */}
<header className="bg-emerald-600 text-white">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<h1 className="text-2xl font-semibold">อัปเดตพิกัดฟาร์ม (GPS มือถือ)</h1>
<Link
to="/ah"
className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20 focus:outline-none"
>
กลับหน้า Animal husbandry
</Link>
</div>
</header>

<main className="mx-auto max-w-6xl px-4 py-6">
{err && (
<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
{err}
</div>
)}
{msg && (
<div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
{msg}
</div>
)}

<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
<div className="md:col-span-2">
<div className="font-semibold mb-2">เลือกฟาร์ม —</div>
<SearchBox
list={farms}
value={farmId}
onChange={setFarmId}
/>
{loading && (
<div className="text-gray-500 mt-3">กำลังโหลด…</div>
)}
{!loading && farms.length === 0 && (
<div className="text-gray-500 mt-3">
ไม่มีฟาร์มที่ต้องอัปเดตพิกัด
</div>
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

<label className="block text-sm text-gray-600 mb-1">Long</label>
<input
value={long}
onChange={(e) => setLong(e.target.value)}
placeholder="เช่น 100.987654"
className="mb-3 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
/>

<div className="flex gap-2">
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
disabled={loading || !farmId || !lat || !long}
>
บันทึก
</button>
</div>

<div className="text-xs text-gray-500 mt-2">
* จะบันทึกได้เมื่อเลือกฟาร์มและกรอก lat/long ครบ
</div>
</div>
</div>
</div>
</main>
</div>
);
}
