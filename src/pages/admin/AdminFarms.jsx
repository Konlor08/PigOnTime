// src/pages/admin/AdminFarms.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../../supabaseClient";
import { Link } from "react-router-dom";

// mapping ของ status ให้กดสลับง่าย ๆ
const nextStatus = (s) => (String(s).toLowerCase() === "active" ? "inactive" : "active");

export default function AdminFarms() {
const navigate = useNavigate();

// ui state
const [loading, setLoading] = useState(false);
const [err, setErr] = useState("");
const [rows, setRows] = useState([]);
const [q, setQ] = useState("");

// form state (add / edit)
const emptyForm = {
id: null,

plant: "",
house: "",
branch: "",
farm_name: "",
subdistrict: "",
district: "",
province: "",
lat: "",
long: "",
status: "active",
};
const [form, setForm] = useState(emptyForm);
const [openForm, setOpenForm] = useState(false);

// อ่านข้อมูลครั้งแรก
useEffect(() => {
let alive = true;
(async () => {
setLoading(true);
setErr("");
try {
const { data, error } = await supabase
.from("farms")
.select(
"id, plant, house, branch, farm_name, subdistrict, district, province, lat, long, status"
)
.order("plant", { ascending: true });

if (error) throw error;
if (alive) setRows(data ?? []);
} catch (e) {
setErr(e.message || "Load failed");
} finally {
if (alive) setLoading(false);
}
})();
return () => {
alive = false;
};
}, []);

// filter ค้นหาแบบง่าย
const filtered = useMemo(() => {
if (!q.trim()) return rows;
const k = q.toLowerCase();
return rows.filter((r) =>
[

r.farm_name,
r.plant,
r.branch,
r.house,
r.subdistrict,
r.district,
r.province,
r.status,
]
.filter(Boolean)
.some((v) => String(v).toLowerCase().includes(k))
);
}, [rows, q]);

// เปิดฟอร์มเพิ่ม/แก้ไข
const openAdd = () => {
setForm(emptyForm);
setOpenForm(true);
};
const openEdit = (r) => {
setForm({
id: r.id,

plant: r.plant || "",
house: r.house || "",
branch: r.branch || "",
farm_name: r.farm_name || "",
subdistrict: r.subdistrict || "",
district: r.district || "",
province: r.province || "",
lat: r.lat ?? "",
long: r.long ?? "",
status: r.status || "active",
});
setOpenForm(true);
};

// submit ฟอร์ม
const handleSubmit = async (e) => {
e.preventDefault();
setLoading(true);
setErr("");

// แปลง lat/long เป็น number หรือ null
const lat =
form.lat === "" || form.lat === null ? null : Number.isFinite(+form.lat) ? +form.lat : null;
const long =
form.long === "" || form.long === null ? null : Number.isFinite(+form.long) ? +form.long : null;

try {
if (form.id) {
// update
const { data, error } = await supabase
.from("farms")
.update({

plant: form.plant || null,
house: form.house || null,
branch: form.branch || null,
farm_name: form.farm_name,
subdistrict: form.subdistrict || null,
district: form.district || null,
province: form.province || null,
lat,
long,
status: form.status || "active",
updated_at: new Date().toISOString(),
})
.eq("id", form.id)
.select()
.single();
if (error) throw error;
setRows((prev) => prev.map((x) => (x.id === form.id ? data : x)));
} else {
// insert
const { data, error } = await supabase
.from("farms")
.insert([
{

plant: form.plant || null,
house: form.house || null,
branch: form.branch || null,
farm_name: form.farm_name,
subdistrict: form.subdistrict || null,
district: form.district || null,
province: form.province || null,
lat,
long,
status: form.status || "active",
},
])
.select()
.single();
if (error) throw error;
setRows((prev) => [data, ...prev]);
}
setOpenForm(false);
} catch (e) {
setErr(e.message || "Save failed");
} finally {
setLoading(false);
}
};

// toggle active/inactive
const handleToggleStatus = async (r) => {
setLoading(true);
setErr("");
try {
const to = nextStatus(r.status);
const { data, error } = await supabase
.from("farms")
.update({ status: to, updated_at: new Date().toISOString() })
.eq("id", r.id)
.select()
.single();
if (error) throw error;
setRows((prev) => prev.map((x) => (x.id === r.id ? data : x)));
} catch (e) {
setErr(e.message || "Update failed");
} finally {
setLoading(false);
}
};

return (

<div className="min-h-screen bg-gray-100">
{/* Header bar */}
<header className="bg-blue-600 text-white">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<h1 className="text-2xl font-semibold">Farms</h1>

<div className="flex items-center gap-2">
<button
type="button"
onClick={() => navigate("/admin")}
className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20 active:scale-[.98]"
title="Back"
>
Back to Admin
</button>
</div>
</div>


</header>

{/* Content */}
<main className="mx-auto max-w-6xl px-4 py-6">
{/* Toolbar */}
<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
<div className="flex gap-2">
<button
type="button"
onClick={openAdd}
className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 active:scale-[.98]"
>
Add Farm
</button>
<button
type="button"
onClick={() => window.location.reload()}
className="rounded-md border px-4 py-2 hover:bg-gray-50 active:scale-[.98]"
>
Refresh
</button>
<Link 
    to="/admin/farms/upload"
    className="rounded-md border px-4 py-2 hover:bg-gray-50 active:scale-[.98]"
    >
     Upload Excel 
     </Link>
</div>

<input
value={q}
onChange={(e) => setQ(e.target.value)}
placeholder="Search..."
className="w-full sm:w-72 rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</div>

{/* Error */}
{err && (
<div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
{err}
</div>
)}

{/* Table */}
<div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
<table className="min-w-full text-sm">
<thead className="bg-gray-50 text-gray-700">
<tr>

<Th>Plant</Th>
<Th>House</Th>
<Th>Branch</Th>
<Th>Farm name</Th>
<Th>Subdistrict</Th>
<Th>District</Th>
<Th>Province</Th>
<Th className="text-right">Lat</Th>
<Th className="text-right">Long</Th>
<Th>Status</Th>
<Th>Actions</Th>
</tr>
</thead>
<tbody>
{filtered.length === 0 && (
<tr>
<td colSpan={12} className="px-4 py-8 text-center text-gray-500">
No data
</td>
</tr>
)}

{filtered.map((r) => (
<tr key={r.id} className="border-t hover:bg-gray-50">

<Td>{r.plant}</Td>
<Td>{r.house}</Td>
<Td>{r.branch}</Td>
<Td className="font-medium text-gray-900">{r.farm_name}</Td>
<Td>{r.subdistrict}</Td>
<Td>{r.district}</Td>
<Td>{r.province}</Td>
<Td className="text-right">{r.lat ?? ""}</Td>
<Td className="text-right">{r.long ?? ""}</Td>
<Td>
<span
className={
"inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
(String(r.status).toLowerCase() === "active"
? "bg-green-100 text-green-700"
: "bg-gray-200 text-gray-700")
}
>
{String(r.status || "").toLowerCase() === "active" ? "active" : "inactive"}
</span>
</Td>
<Td>
<div className="flex gap-2">
<button
type="button"
onClick={() => openEdit(r)}
className="rounded-md border px-2.5 py-1 hover:bg-gray-50"
>
Edit
</button>
<button
type="button"
onClick={() => handleToggleStatus(r)}
className="rounded-md bg-indigo-600 px-2.5 py-1 text-white hover:bg-indigo-700"
>
Toggle
</button>
</div>
</Td>
</tr>
))}
</tbody>
</table>
</div>

{/* Footer loading */}
{loading && (
<p className="mt-3 text-sm text-gray-500">
Processing…
</p>
)}
</main>

{/* Drawer / Modal (ง่าย ๆ ใช้กล่องลอย) */}
{openForm && (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-2">
<div className="w-full max-w-2xl rounded-xl bg-white p-4 sm:p-6 shadow-lg">
<div className="mb-4 flex items-center justify-between">
<h2 className="text-lg font-semibold">
{form.id ? "Edit Farm" : "Add Farm"}
</h2>
<button
type="button"
onClick={() => setOpenForm(false)}
className="rounded-md border px-2 py-1 hover:bg-gray-50"
>
Close
</button>
</div>

<form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">


<Field label="Farm name" required>
<input
required
value={form.farm_name}
onChange={(e) => setForm({ ...form, farm_name: e.target.value })}
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</Field>

<Field label="Plant">
<input
value={form.plant}
onChange={(e) => setForm({ ...form, plant: e.target.value })}
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</Field>
<Field label="House">
<input
value={form.house}
onChange={(e) => setForm({ ...form, house: e.target.value })}
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</Field>

<Field label="Branch">
<input
value={form.branch}
onChange={(e) => setForm({ ...form, branch: e.target.value })}
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</Field>
<Field label="Subdistrict">
<input
value={form.subdistrict}
onChange={(e) => setForm({ ...form, subdistrict: e.target.value })}
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</Field>

<Field label="District">
<input
value={form.district}
onChange={(e) => setForm({ ...form, district: e.target.value })}
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</Field>
<Field label="Province">
<input
value={form.province}
onChange={(e) => setForm({ ...form, province: e.target.value })}
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</Field>

<Field label="Lat">
<input
value={form.lat}
onChange={(e) => setForm({ ...form, lat: e.target.value })}
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
inputMode="decimal"
/>
</Field>
<Field label="Long">
<input
value={form.long}
onChange={(e) => setForm({ ...form, long: e.target.value })}
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
inputMode="decimal"
/>
</Field>

<Field label="Status">
<select
value={form.status}
onChange={(e) => setForm({ ...form, status: e.target.value })}
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
>
<option value="active">active</option>
<option value="inactive">inactive</option>
</select>
</Field>

<div className="sm:col-span-2 mt-2 flex justify-end gap-2">
<button
type="button"
onClick={() => setOpenForm(false)}
className="rounded-md border px-4 py-2 hover:bg-gray-50"
>
Cancel
</button>
<button
type="submit"
disabled={loading}
className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
>
{form.id ? "Save" : "Create"}
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
}

/* ------------- small presentational components ------------- */
function Th({ className = "", children }) {
return <th className={`px-3 py-2 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ className = "", children }) {
return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
function Field({ label, required = false, children }) {
return (
<label className="block">
<span className="mb-1 block text-sm text-gray-700">
{label} {required ? <span className="text-red-500">*</span> : null}
</span>
{children}
</label>
);
}
