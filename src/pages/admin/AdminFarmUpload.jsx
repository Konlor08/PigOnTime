// src/pages/admin/AdminFarmUpload.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import supabase from "../../supabaseClient";

// helper: ว่าง?
const isBlank = (v) => v === undefined || v === null || String(v).trim() === "";

// ให้ key เดียวกันสำหรับการเทียบแถวเดิม
const keyOf = (r) =>
`${String(r.plant || "").trim()}|${String(r.house || "").trim()}|${String(r.branch || "").trim()}`;

// แปลงชื่อคอลัมน์ให้เป็นเคสที่รองรับ
const normalizeRow = (r) => {
// รองรับหัวคอลัมน์หลายรูปแบบ
const pick = (keys) => {
for (const k of keys) {
if (r[k] !== undefined) return r[k];
if (r[String(k).toLowerCase()] !== undefined) return r[String(k).toLowerCase()];
if (r[String(k).toUpperCase()] !== undefined) return r[String(k).toUpperCase()];
}
return "";
};

return {
plant: pick(["plant"]),
house: pick(["house"]),
branch: pick(["branch"]),
farm_name: pick(["farm_name", "farmname", "name"]),
subdistrict: pick(["subdistrict", "tambon"]),
district: pick(["district", "amphoe"]),
province: pick(["province", "changwat"]),
lat: pick(["lat", "latitude"]),
long: pick(["long", "lng", "longitude"]),
status: pick(["status"]),
};
};

export default function AdminFarmUpload() {


const [fileName, setFileName] = useState("");
const [rawRows, setRawRows] = useState([]); // preview จากไฟล์ (ยังไม่ normalize)
const [rows, setRows] = useState([]); // normalize แล้ว
const [loading, setLoading] = useState(false);
const [msg, setMsg] = useState("");
const [err, setErr] = useState("");

const handleFileChange = async (e) => {
setMsg("");
setErr("");
setRawRows([]);
setRows([]);

const f = e.target.files?.[0];
if (!f) return;

setFileName(f.name);
try {
const buf = await f.arrayBuffer();
const wb = XLSX.read(buf, { type: "array" });
const ws = wb.Sheets[wb.SheetNames[0]];
const json = XLSX.utils.sheet_to_json(ws, { defval: "" }); // raw
setRawRows(json);

// normalize column names/values
const norm = json.map(normalizeRow);
setRows(norm);
} catch (e) {
setErr(e.message || "อ่านไฟล์ไม่สำเร็จ");
}
};

const handleClear = () => {
setFileName("");
setRawRows([]);
setRows([]);
setMsg("");
setErr("");
};

const handleImport = async () => {
if (rows.length === 0) {
setErr("ยังไม่มีข้อมูลสำหรับนำเข้า");
return;
}

setLoading(true);
setMsg("");
setErr("");

try {
// 1) ดึงข้อมูลเดิมทั้งหมด (ง่ายสุด / ไม่แตะส่วนอื่นของระบบ)
// ถ้าข้อมูลเยอะมากค่อยปรับเป็น .or(and(plant.eq...,house.eq...,branch.eq...))
const { data: all, error: selErr } = await supabase
.from("farms")
.select(
"id, plant, house, branch, farm_name, subdistrict, district, province, lat, long, status"
);

if (selErr) throw selErr;

const mapOld = new Map();
(all ?? []).forEach((r) => mapOld.set(keyOf(r), r));

let inserted = 0;
let updated = 0;
let skipped = 0;

// 2) วนตามแถวจากไฟล์
for (const r of rows) {
// ต้องมี key หลักให้ครบ
if (isBlank(r.plant) || isBlank(r.house) || isBlank(r.branch)) {
skipped++;
continue;
}

const k = keyOf(r);
const old = mapOld.get(k);

if (old) {
// UPDATE: ถ้าในไฟล์ว่าง => คงค่าเดิม
const patch = {
plant: old.plant, // คีย์ เดิม
house: old.house,
branch: old.branch,
farm_name: isBlank(r.farm_name) ? old.farm_name : String(r.farm_name).trim(),
subdistrict: isBlank(r.subdistrict) ? old.subdistrict : String(r.subdistrict).trim(),
district: isBlank(r.district) ? old.district : String(r.district).trim(),
province: isBlank(r.province) ? old.province : String(r.province).trim(),
// lat/long: ถ้าว่างคงค่าเดิม
lat: isBlank(r.lat) ? old.lat : Number.isFinite(+r.lat) ? +r.lat : old.lat,
long: isBlank(r.long) ? old.long : Number.isFinite(+r.long) ? +r.long : old.long,
// status: ถ้าว่างคงเดิม
status: isBlank(r.status) ? old.status : String(r.status).trim().toLowerCase(),
updated_at: new Date().toISOString(),
};

const { error: upErr, data: upRow } = await supabase
.from("farms")
.update(patch)
.eq("id", old.id)
.select()
.single();

if (upErr) throw upErr;
// อัปเดตแคช
mapOld.set(k, upRow);
updated++;
} else {
// INSERT: ถ้าว่างให้เป็น null / status ถ้าไม่ได้ระบุ -> active
const doc = {
plant: String(r.plant).trim(),
house: String(r.house).trim(),
branch: String(r.branch).trim(),
farm_name: isBlank(r.farm_name) ? "" : String(r.farm_name).trim(),
subdistrict: isBlank(r.subdistrict) ? null : String(r.subdistrict).trim(),
district: isBlank(r.district) ? null : String(r.district).trim(),
province: isBlank(r.province) ? null : String(r.province).trim(),
lat: isBlank(r.lat) ? null : Number.isFinite(+r.lat) ? +r.lat : null,
long: isBlank(r.long) ? null : Number.isFinite(+r.long) ? +r.long : null,
status: isBlank(r.status) ? "active" : String(r.status).trim().toLowerCase(),
};

const { error: insErr, data: insRow } = await supabase
.from("farms")
.insert([doc])
.select()
.single();

if (insErr) throw insErr;
mapOld.set(k, insRow);
inserted++;
}
}

setMsg(`นำเข้าสำเร็จ: inserted ${inserted}, updated ${updated}, skipped ${skipped}`);
} catch (e) {
setErr(e.message || "นำเข้าไม่สำเร็จ");
} finally {
setLoading(false);
}
};

return (
<div className="min-h-screen bg-gray-100">
{/* Header bar (Theme เดิม) */}
<header className="bg-blue-600 text-white">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<h1 className="text-2xl font-semibold">Upload Farms (Excel/CSV)</h1>
<div className="flex items-center gap-2">
<Link
to="/admin/farms"
className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20 active:scale-[.98]"
>
← Back
</Link>
</div>
</div>
</header>

{/* Content */}
<main className="mx-auto max-w-6xl px-4 py-6">
{/* Alert */}
{err && (
<div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
{err}
</div>
)}
{msg && (
<div className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
{msg}
</div>
)}

{/* กล่องอัปโหลด (Theme เดิม) */}
<div className="rounded-xl border bg-white p-4 shadow-sm">
<h2 className="text-lg font-semibold mb-3">เลือกไฟล์</h2>

<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
<input
type="file"
accept=".xlsx,.xls,.csv"
onChange={handleFileChange}
className="block"
/>
<div className="text-sm text-gray-600 flex-1">
รองรับหัวคอลัมน์:
<span className="ml-1">
plant, house, branch, farm_name, subdistrict, district, province, lat, long, status
</span>
</div>
</div>

{fileName && (
<p className="text-sm text-gray-500 mt-2">
ไฟล์: <span className="font-medium">{fileName}</span>
</p>
)}

{/* Preview Table (แสดงก่อน import) */}
{rawRows.length > 0 && (
<div className="mt-4 overflow-x-auto rounded-md border">
<table className="min-w-full text-sm">
<thead className="bg-gray-50">
<tr>
{Object.keys(rawRows[0]).map((col) => (
<th key={col} className="px-3 py-2 text-left border-b">
{col}
</th>
))}
</tr>
</thead>
<tbody>
{rawRows.map((row, i) => (
<tr key={i} className="hover:bg-gray-50">
{Object.keys(rawRows[0]).map((col) => (
<td key={col} className="px-3 py-2 border-b">
{row[col]}
</td>
))}
</tr>
))}
</tbody>
</table>
<p className="text-xs text-gray-500 px-3 py-2">
แสดงข้อมูลฟาร์มจำนวน {rawRows.length} แถว
</p>
</div>
)}

{/* Actions */}
<div className="mt-4 flex gap-2">
<button
type="button"
onClick={handleImport}
disabled={loading || rows.length === 0}
className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 active:scale-[.98] disabled:opacity-60"
>
{loading ? "Importing..." : "Import"}
</button>
<button
type="button"
onClick={handleClear}
disabled={loading}
className="rounded-md border px-4 py-2 hover:bg-gray-50 active:scale-[.98]"
>
Clear
</button>
</div>

<p className="text-xs text-gray-500 mt-3">
หมายเหตุ: ถ้าช่องในไฟล์ว่าง ระบบจะ<strong>คงค่าดั้งเดิม</strong>ในฐานข้อมูลไว้
และเมื่อเพิ่มแถวใหม่โดยไม่ได้ระบุ <code>status</code> จะถูกตั้งเป็น{" "}
<code>active</code> อัตโนมัติ
</p>
</div>
</main>
</div>
);
}
