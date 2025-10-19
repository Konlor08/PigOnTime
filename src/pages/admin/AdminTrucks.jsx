// src/pages/admin/AdminTrucks.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../../supabaseClient";

// helper
const isBlank = (v) => v === undefined || v === null || String(v).trim() === "";

export default function AdminTrucks() {
const navigate = useNavigate();

// UI state
const [loading, setLoading] = useState(false);
const [err, setErr] = useState("");
const [rows, setRows] = useState([]);
const [q, setQ] = useState("");

// form state
const emptyForm = {
id: null,
plate: "",
capacity: "",
livestock_type: "",
active: true, // insert → default true
};
const [form, setForm] = useState(emptyForm);
const [openForm, setOpenForm] = useState(false);

// load
useEffect(() => {
let alive = true;
(async () => {
setLoading(true);
setErr("");
try {
const { data, error } = await supabase
.from("trucks")
.select("id, plate, capacity, livestock_type, active, created_at")
.order("plate", { ascending: true });
if (error) throw error;
if (alive) setRows(data ?? []);
} catch (e) {
setErr(e.message || "Load failed");
} finally {
if (alive) setLoading(false);
}
})();
return () => { alive = false; };
}, []);

// filter simple
const filtered = useMemo(() => {
if (!q.trim()) return rows;
const k = q.toLowerCase();
return rows.filter((r) =>
[r.plate, r.livestock_type, String(r.capacity), r.active ? "active" : "inactive"]
.filter(Boolean)
.some((v) => String(v).toLowerCase().includes(k))
);
}, [rows, q]);

// actions
const openAdd = () => { setForm(emptyForm); setOpenForm(true); };
const openEdit = (r) => {
setForm({
id: r.id,
plate: r.plate || "",
capacity: r.capacity ?? "",
livestock_type: r.livestock_type || "",
active: !!r.active,
});
setOpenForm(true);
};

const handleSubmit = async (e) => {
e.preventDefault();
setLoading(true);
setErr("");

// normalize
const payload = {
plate: form.plate.trim(),
capacity: isBlank(form.capacity) ? null : Number(form.capacity),
livestock_type: isBlank(form.livestock_type) ? null : form.livestock_type.trim(),
active: typeof form.active === "boolean" ? form.active : true, // default true on insert
};

try {
if (form.id) {
const { data, error } = await supabase
.from("trucks")
.update(payload)
.eq("id", form.id)
.select()
.single();
if (error) throw error;
setRows((prev) => prev.map((x) => (x.id === form.id ? data : x)));
} else {
const { data, error } = await supabase
.from("trucks")
.insert([{ ...payload }])
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

const toggleActive = async (r) => {
setLoading(true);
setErr("");
try {
const to = !r.active;
const { data, error } = await supabase
.from("trucks")
.update({ active: to })
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
{/* Header (theme เดิม) */}
<header className="bg-blue-600 text-white">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<h1 className="text-2xl font-semibold">Trucks</h1>
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
<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
<div className="flex gap-2">
<button
type="button"
onClick={openAdd}
className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 active:scale-[.98]"
>
Add Truck
</button>
<button
type="button"
onClick={() => window.location.reload()}
className="rounded-md border px-4 py-2 hover:bg-gray-50 active:scale-[.98]"
>
Refresh
</button>
</div>

<input
value={q}
onChange={(e) => setQ(e.target.value)}
placeholder="Search..."
className="w-full sm:w-72 rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</div>

{err && (
<div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
{err}
</div>
)}

<div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
<table className="min-w-full text-sm">
<thead className="bg-gray-50 text-gray-700">
<tr>
<Th>Plate</Th>
<Th className="text-right w-24">Capacity</Th>
<Th>Livestock type</Th>
<Th>Status</Th>
<Th>Actions</Th>
</tr>
</thead>
<tbody>
{filtered.length === 0 && (
<tr>
<td colSpan={5} className="px-4 py-8 text-center text-gray-500">
No data
</td>
</tr>
)}

{filtered.map((r) => (
<tr key={r.id} className="border-t hover:bg-gray-50">
<Td className="font-medium text-gray-900">{r.plate}</Td>
<Td className="text-right">{r.capacity ?? ""}</Td>
<Td>{r.livestock_type}</Td>
<Td>
<span
className={
"inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
(r.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700")
}
>
{r.active ? "active" : "inactive"}
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
onClick={() => toggleActive(r)}
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

{loading && <p className="mt-3 text-sm text-gray-500">Processing…</p>}
</main>

{/* modal ฟอร์ม */}
{openForm && (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-2">
<div className="w-full max-w-lg rounded-xl bg-white p-4 sm:p-6 shadow-lg">
<div className="mb-4 flex items-center justify-between">
<h2 className="text-lg font-semibold">{form.id ? "Edit Truck" : "Add Truck"}</h2>
<button
type="button"
onClick={() => setOpenForm(false)}
className="rounded-md border px-2 py-1 hover:bg-gray-50"
>
Close
</button>
</div>

<form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
<Field label="Plate" required>
<input
required
value={form.plate}
onChange={(e) => setForm({ ...form, plate: e.target.value })}
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</Field>

<Field label="Capacity">
<input
value={form.capacity}
onChange={(e) => setForm({ ...form, capacity: e.target.value })}
inputMode="decimal"
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</Field>

<Field label="Livestock type">
<input
value={form.livestock_type}
onChange={(e) => setForm({ ...form, livestock_type: e.target.value })}
className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</Field>

<Field label="Status">
<select
value={form.active ? "active" : "inactive"}
onChange={(e) => setForm({ ...form, active: e.target.value === "active" })}
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
className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
>
Save
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
}

/* ฝา้ย UI ย่อยให้เหมือน theme เดิม */
function Th({ children, className = "" }) {
return <th className={`px-4 py-2 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
return <td className={`px-4 py-2 align-top ${className}`}>{children}</td>;
}
function Field({ label, required, children }) {
return (
<label className="flex flex-col gap-1">
<span className="text-sm text-gray-700">
{label} {required ? <span className="text-red-500">*</span> : null}
</span>
{children}
</label>
);
}
