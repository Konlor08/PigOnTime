// src/pages/LinkAHFarms.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import supabase from "../lib/supabaseClient";

function Pill({ status }) {
const on = String(status).toLowerCase() === "active";
return (
<span
className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
on ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
}`}
>
{on ? "active" : "inactive"}
</span>
);
}

/** กล่องค้นหา/เลือก (ตัดแถว “No selection” ออก) */
function SearchBox({ list, value, onChange, labelKey, placeholder = "Search..." }) {
const [q, setQ] = useState("");

// ล้างคำค้นเมื่อ selection ถูกรีเซ็ต
useEffect(() => {
if (!value) setQ("");
}, [value]);

const results = useMemo(() => {
const s = q.trim().toLowerCase();
if (!s) return list;
return list.filter((x) => String(x[labelKey] || "").toLowerCase().includes(s));
}, [q, list, labelKey]);

return (
<div className="rounded-xl border bg-white p-3">
<input
value={q}
onChange={(e) => setQ(e.target.value)}
placeholder={placeholder}
className="mb-2 w-full rounded-md border px-3 py-2"
autoFocus
/>
<div className="max-h-72 overflow-auto">
{results.map((x) => (
<button
key={x.id}
type="button"
onClick={() => onChange(x.id)}
className={`mb-1 w-full rounded-md border px-3 py-2 text-left ${
value === x.id ? "bg-emerald-50" : ""
}`}
>
{x[labelKey]}
</button>
))}
</div>
</div>
);
}

export default function LinkAHFarms() {
// current user (AH)
let currentUser = null;
try {
currentUser = JSON.parse(localStorage.getItem("user") || "null");
} catch {
currentUser = null;
}

const ahId = currentUser?.id || null;
const ahPin = currentUser?.pin || "";
const ahLabel = `AH (${ahPin || "-"})`;

const [farms, setFarms] = useState([]); // ฟาร์มทั้งหมด
const [linkedFarmIds, setLinkedFarmIds] = useState([]); // ฟาร์มที่ผูกกับ AH แล้ว
const [selFarm, setSelFarm] = useState("");
const [rows, setRows] = useState([]);

const [loading, setLoading] = useState(false);
const [msg, setMsg] = useState("");
const [err, setErr] = useState("");

// ซ่อนข้อความสำเร็จ 3 วิ
useEffect(() => {
if (!msg) return;
const t = setTimeout(() => setMsg(""), 3000);
return () => clearTimeout(t);
}, [msg]);

const loadFarms = useCallback(async () => {
const { data, error } = await supabase
.from("farms")
.select("id, plant, branch, house, farm_name")
.order("plant");
if (error) setErr(error.message);
else
setFarms(
(data || []).map((f) => ({
id: f.id,
label: `${f.plant} / ${f.branch} / ${f.house} / ${f.farm_name}`,
}))
);
}, []);

const loadMyRelations = useCallback(async () => {
if (!ahId) return;
const { data, error } = await supabase
.from("ah_farm_relations")
.select(
`
id, status,
farm:farms(id, plant, branch, house, farm_name)
`
)
.eq("ah_id", ahId)
.order("created_at", { ascending: false });

if (error) setErr(error.message);
else {
const list = data || [];
setRows(
list.map((r) => ({
id: r.id,
status: r.status,
left: ahLabel,
right: r.farm
? `${r.farm.plant} / ${r.farm.branch} / ${r.farm.house} / ${r.farm.farm_name}`
: "",
}))
);
setLinkedFarmIds(list.map((r) => r.farm?.id).filter(Boolean));
}
}, [ahId, ahLabel]);

useEffect(() => {
setErr("");
Promise.all([loadFarms(), loadMyRelations()]);
}, [loadFarms, loadMyRelations]);

// ฟาร์มที่ “ยังไม่ถูกเชื่อมกับ AH” เท่านั้น
const selectableFarms = useMemo(() => {
const linked = new Set(linkedFarmIds);
return farms.filter((f) => !linked.has(f.id));
}, [farms, linkedFarmIds]);

async function addRelation() {
if (!ahId) return setErr("ไม่พบผู้ใช้งานปัจจุบัน");
if (!selFarm) return setErr("กรุณาเลือกฟาร์ม");
setLoading(true);
setErr("");
try {
const { error } = await supabase
.from("ah_farm_relations")
.insert([{ ah_id: ahId, farm_id: selFarm, status: "active" }]);
if (error) throw error;
setSelFarm(""); // รีเซ็ตหลังบันทึก
setMsg("บันทึกสำเร็จ");
await loadMyRelations(); // ฟาร์มที่เพิ่งผูกจะหายจากกล่องเลือก
} catch (e) {
setErr(e.message || "บันทึกล้มเหลว");
} finally {
setLoading(false);
}
}

async function toggleRelation(id, status) {
const to = String(status).toLowerCase() === "active" ? "inactive" : "active";
const { error } = await supabase
.from("ah_farm_relations")
.update({ status: to })
.eq("id", id);
if (error) setErr(error.message);
else loadMyRelations();
}

async function deleteRelation(id) {
const { error } = await supabase.from("ah_farm_relations").delete().eq("id", id);
if (error) setErr(error.message);
else loadMyRelations();
}

return (
<div className="min-h-screen bg-emerald-50">
{/* Header */}
<header className="bg-emerald-600 text-white">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<h1 className="text-2xl font-semibold">เชื่อมโยงฉัน ↔ ฟาร์ม</h1>
<Link
to="/ah"
className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
>
กลับหน้า Animal husbandry
</Link>
</div>
</header>

{/* Content */}
<main className="mx-auto max-w-6xl px-4 py-6">
{msg && (
<div className="mb-3 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-700">
{msg}
</div>
)}
{err && (
<div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">
{err}
</div>
)}

{/* Selectors */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
{/* Left: AH (locked) */}
<div>
<div className="mb-2 text-sm text-gray-700">Animal husbandry —</div>
<div className="rounded-xl border bg-white p-3">
<div className="text-gray-700">{ahLabel}</div>
<div className="text-xs text-gray-500 mt-1">ล็อกเป็นผู้ใช้ปัจจุบัน</div>
</div>
</div>

{/* Right: Farm search */}
<div>
<div className="mb-2 text-sm text-gray-700">เลือกฟาร์ม —</div>
<SearchBox
list={selectableFarms}
value={selFarm}
onChange={setSelFarm}
labelKey="label"
placeholder="Search..."
/>
</div>
</div>

<button
type="button"
disabled={loading}
onClick={addRelation}
className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
>
{loading ? "Saving..." : "Create Relation"}
</button>

{/* Table */}
<div className="mt-4 overflow-x-auto rounded-xl border bg-white">
<table className="min-w-full text-sm">
<thead className="bg-gray-50 text-gray-700">
<tr>
<th className="px-3 py-2 text-left">Left (Animal husbandry)</th>
<th className="px-3 py-2 text-left">Right (Farm)</th>
<th className="px-3 py-2 text-left">Status</th>
<th className="px-3 py-2 text-left">Actions</th>
</tr>
</thead>
<tbody>
{rows.length === 0 ? (
<tr>
<td colSpan={4} className="px-3 py-6 text-center text-gray-500">
No data
</td>
</tr>
) : (
rows.map((r) => (
<tr key={r.id} className="border-t">
<td className="px-3 py-2">{r.left}</td>
<td className="px-3 py-2">{r.right}</td>
<td className="px-3 py-2">
<Pill status={r.status} />
</td>
<td className="px-3 py-2">
<div className="flex gap-2">
<button
className="rounded-md bg-indigo-600 px-2.5 py-1 text-white hover:bg-indigo-700"
onClick={() => toggleRelation(r.id, r.status)}
>
Toggle
</button>
<button
className="rounded-md border px-2.5 py-1 hover:bg-gray-50"
onClick={() => deleteRelation(r.id)}
>
Delete
</button>
</div>
</td>
</tr>
))
)}
</tbody>
</table>
</div>
</main>
</div>
);
}
