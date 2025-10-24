// src/pages/AHLinkFarmFactory.jsx
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import logo from "../assets/logo.png";

/* ---------- กล่องค้นหาแบบลิสต์ (ไม่มี "No selection") ---------- */
function SearchBox({ list, value, onChange, labelKey = "label", placeholder = "Search..." }) {
const [q, setQ] = useState("");
const results = (list || []).filter((x) => {
const label = String(x[labelKey] ?? "").toLowerCase();
return !q || label.includes(q.toLowerCase());
});
const current = (list || []).find((x) => x.id === value);

return (
<div className="w-full sm:w-[28rem] rounded-xl border bg-white shadow-sm">
<div className="p-3 border-b">
<input
value={q}
onChange={(e) => setQ(e.target.value)}
className="w-full rounded-md border px-3 py-2"
placeholder={placeholder}
/>
{current ? (
<div className="mt-2 text-sm">
เลือกแล้ว: <span className="font-medium">{current[labelKey]}</span>
<button
type="button"
onClick={() => onChange("")}
className="ml-2 rounded border px-2 py-0.5 text-xs hover:bg-gray-50"
>
เคลียร์
</button>
</div>
) : null}
</div>
<div className="max-h-72 overflow-y-auto p-2">
{results.length === 0 ? (
<div className="px-2 py-6 text-center text-sm text-gray-500">ไม่พบรายการ</div>
) : (
results.map((x) => (
<button
key={x.id}
type="button"
className={
"mb-2 w-full rounded-md border px-3 py-2 text-left hover:bg-gray-50 " +
(x.id === value ? "ring-2 ring-emerald-500" : "")
}
onClick={() => onChange(x.id)}
>
{x[labelKey]}
</button>
))
)}
</div>
</div>
);
}

/* ---------- ป้ายสถานะ ---------- */
function Pill({ status }) {
const on = String(status).toLowerCase() === "active";
return (
<span
className={
"inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
(on ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700")
}
>
{on ? "active" : "inactive"}
</span>
);
}

/* ================================================================== */
/* AH เชื่อมโยง ฟาร์ม ↔ โรงงาน */
/* ================================================================== */
export default function AHLinkFarmFactory() {
// ---------- session ----------
let currentUser = null;
try {
currentUser = JSON.parse(localStorage.getItem("user") || "null");
} catch {
currentUser = null;
}
const ahId = currentUser?.id || "";

// ---------- ui state ----------
const [loading, setLoading] = useState(false);
const [msg, setMsg] = useState("");
const [err, setErr] = useState("");

// ให้ข้อความสำเร็จหายเอง 3 วิ / error ค้างไว้จนเปลี่ยน
useEffect(() => {
if (!msg) return;
const t = setTimeout(() => setMsg(""), 3000);
return () => clearTimeout(t);
}, [msg]);

// ---------- dropdown lists ----------
const [farms, setFarms] = useState([]); // farms ที่ผูกกับ AH นี้แล้วเท่านั้น
const [factories, setFactories] = useState([]); // โรงงานทั้งหมด

// ---------- selections ----------
const [selFarm, setSelFarm] = useState("");
const [selFactory, setSelFactory] = useState("");

// ---------- ตารางผลลัพธ์ ----------
const [rows, setRows] = useState([]);

/* -------- โหลดรายชื่อฟาร์มของ AH -------- */
const loadFarmsOfAH = useCallback(async () => {
setErr("");
if (!ahId) {
setFarms([]);
return;
}
// ดึง farm_id ที่ผูกอยู่กับ AH (active)
const { data: rels, error: e1 } = await supabase
.from("ah_farm_relations")
.select("farm_id")
.eq("ah_id", ahId)
.eq("status", "active");

if (e1) {
setErr(e1.message);
return;
}
const ids = (rels || []).map((r) => r.farm_id);
if (ids.length === 0) {
setFarms([]);
return;
}

const { data, error } = await supabase
.from("farms")
.select("id, plant, branch, house, farm_name")
.in("id", ids)
.order("plant");

if (error) setErr(error.message);
else {
setFarms(
(data || []).map((f) => ({
id: f.id,
label: `${f.plant} / ${f.branch} / ${f.house} / ${f.farm_name}`,
}))
);
}
}, [ahId]);

/* -------- โหลดโรงงานทั้งหมด -------- */
const loadFactories = useCallback(async () => {
const { data, error } = await supabase
.from("factories")
.select("id, name, branch, site")
.order("name");

if (error) setErr(error.message);
else {
setFactories(
(data || []).map((fc) => ({
id: fc.id,
label: `${fc.site ?? ""} ${fc.branch ?? ""} ${fc.name ?? ""}`.trim(),
}))
);
}
}, []);

/* -------- โหลดความสัมพันธ์ farm ↔ factory เฉพาะฟาร์ม -------- */
const loadRows = useCallback(async () => {
setErr("");
if (!ahId) {
setRows([]);
return;
}
// หา farm_ids ของ AH (active)
const { data: rels, error: e1 } = await supabase
.from("ah_farm_relations")
.select("farm_id")
.eq("ah_id", ahId)
.eq("status", "active");

if (e1) {
setErr(e1.message);
return;
}
const ids = (rels || []).map((r) => r.farm_id);
if (ids.length === 0) {
setRows([]);
return;
}

const { data, error } = await supabase
.from("farm_factory_relations")
.select(
`
id, farm_id, factory_id, status,
farm:farms(id, plant, branch, house, farm_name),
factory:factories(id, name, branch, site)
`
)
.in("farm_id", ids)
.order("created_at", { ascending: false });

if (error) setErr(error.message);
else {
setRows(
(data || []).map((r) => ({
id: r.id,
status: r.status,
left: r.farm
? `${r.farm.plant} / ${r.farm.branch} / ${r.farm.house} / ${r.farm.farm_name}`
: r.farm_id,
right: r.factory
? `${r.factory.site ?? ""} ${r.factory.branch ?? ""} ${r.factory.name ?? ""}`.trim()
: r.factory_id,
}))
);
}
}, [ahId]);

/* -------- initial load -------- */
useEffect(() => {
(async () => {
await Promise.all([loadFarmsOfAH(), loadFactories(), loadRows()]);
})();
}, [loadFarmsOfAH, loadFactories, loadRows]);

/* -------- actions -------- */
async function addRelation() {
if (!selFarm || !selFactory) return setErr("กรุณาเลือกฟาร์มและโรงงาน");
setLoading(true);
setErr("");
try {
const { error } = await supabase.from("farm_factory_relations").insert([
{ farm_id: selFarm, factory_id: selFactory, status: "active" },
]);
if (error) throw error;
setMsg("บันทึกสำเร็จ");
setSelFarm("");
setSelFactory("");
await loadRows();
} catch (e) {
setErr(e.message || "เพิ่มความสัมพันธ์ไม่สำเร็จ");
} finally {
setLoading(false);
}
}

const toggleRow = async (id, status) => {
const to = String(status).toLowerCase() === "active" ? "inactive" : "active";
const { error } = await supabase
.from("farm_factory_relations")
.update({ status: to })
.eq("id", id);
if (error) setErr(error.message);
else await loadRows();
};

const deleteRow = async (id) => {
const { error } = await supabase.from("farm_factory_relations").delete().eq("id", id);
if (error) setErr(error.message);
else await loadRows();
};

/* -------- UI -------- */
return (
<div className="min-h-screen bg-emerald-50">
{/* Header (โทน AH) */}
<header className="bg-emerald-600 text-white">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<div className="flex items-center gap-3">
<img src={logo} alt="Pig On Time" className="h-8 w-8 rounded-sm select-none" draggable={false} />
<h1 className="text-2xl font-semibold">เชื่อมโยงฟาร์ม ↔ โรงงาน</h1>
</div>
<Link
to="/ah"
className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20 focus:outline-none"
>
กลับหน้า Animal husbandry
</Link>
</div>
</header>

{/* Content */}
<main className="mx-auto max-w-6xl px-4 py-6">
{/* Alerts */}
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
<div className="rounded-xl border bg-white p-4 shadow-sm">
<div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
<div>
<div className="mb-2 font-medium text-gray-700">เลือกฟาร์ม — (ฟาร์มที่ผูกกับฉัน)</div>
<SearchBox
list={farms}
value={selFarm}
onChange={setSelFarm}
labelKey="label"
placeholder="Search farm..."
/>
</div>
<div>
<div className="mb-2 font-medium text-gray-700">เลือกโรงงาน —</div>
<SearchBox
list={factories}
value={selFactory}
onChange={setSelFactory}
labelKey="label"
placeholder="Search factory..."
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
</div>

{/* Table */}
<div className="mt-6 overflow-x-auto rounded-xl border bg-white shadow-sm">
<table className="min-w-full text-sm">
<thead className="bg-gray-50 text-gray-700">
<tr>
<th className="px-3 py-2 text-left">Farm</th>
<th className="px-3 py-2 text-left">Factory</th>
<th className="px-3 py-2 text-left">Status</th>
<th className="px-3 py-2 text-left">Actions</th>
</tr>
</thead>
<tbody>
{rows.length === 0 ? (
<tr>
<td className="px-3 py-6 text-center text-gray-500" colSpan={4}>
ยังไม่มีความสัมพันธ์สำหรับฟาร์มของฉัน
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
type="button"
className="rounded-md bg-indigo-600 px-2.5 py-1 text-white hover:bg-indigo-700"
onClick={() => toggleRow(r.id, r.status)}
>
Toggle
</button>
<button
type="button"
className="rounded-md border px-2.5 py-1 hover:bg-gray-50"
onClick={() => deleteRow(r.id)}
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
