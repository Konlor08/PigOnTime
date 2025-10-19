// src/pages/UploadPlanning.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import supabase from "../supabaseClient";

/* ======================== CONFIG / MAPPING ======================== */
const normHead = (k) =>
String(k ?? "").replace(/\u00A0/g, " ").trim().replace(/\s+/g, " ");

const isJunkHeader = (h) => {
const lower = String(h ?? "").trim().toLowerCase();
return (
lower === "" ||
lower === "__empty" ||
lower.startsWith("_empty") ||
lower.startsWith("#value") ||
lower === "-" ||
lower.startsWith("_")
);
};

/** Excel Header (TH) -> DB field (EN) */
const STD_MAP = {
ลำดับ: "index_no",
วันที่ส่งถึง: "delivery_date",
เวลาถึงโรงงาน: "delivery_time", // time
เวลาส่งถึง: "timetrucktofarm", // time
Plant: "plant",
House: "house",
สาขา: "branch",

// ฟาร์ม (หลายแบบ)
"ฟาร์ม (โรงเรือน)": "farm_name",
"ฟาร์ม โรงเรือน": "farm_name",
ฟาร์ม: "farm_name",
โรงเรือน: "farm_name",

ตำบล: "subdistrict",
อำเภอ: "district",
จังหวัด: "province",

จำนวนตัว: "quantity",
ทะเบียนรถ: "plate",

อดอาหาร: "อดอาหาร",
นัดรถ: "นัดรถ",
วันที่จับ: "วันที่จับ",
เวลาจับ: "เวลาจับ",
ออกฟาร์ม: "ออกฟาร์ม",
ระยะทาง: "ระยะทาง",
"ไป-กลับ": "ไป-กลับ",
ราดน้ำ: "ราดน้ำ",
ความเร็ว: "ความเร็ว",
"เวลาขนส่ง (น.)ฐาน 100": "เวลาขนส่ง_(น.)ฐาน_100",
"เวลาขนส่ง (ชม.)": "เวลาขนส่ง_(ชม.)",
เอกสาร: "เอกสาร",
รดน้ำ: "รดน้ำ",

"เวลาจับ (h:mm)": "เวลาจับ_(h:mm)", // time
"เวลาถึง รง.(h:mm)": "เวลาถึง_รง.(h:mm)", // time

หมายเหตุ: "remark",
สุกรท้ายเล้า: "culled_swine", // boolean
โรงงาน: "factory",
};

/** ฟิลด์ที่อนุญาต (ต้องตรงกับ DB) */
const ALLOWED_COLS = new Set([
"pk",
"file_name",
"file_id",
"created_at",

"index_no",
"delivery_date",
"delivery_time",
"timetrucktofarm",
"plant",
"house",
"branch",
"farm_name",
"subdistrict",
"district",
"province",
"quantity",
"plate",

"อดอาหาร",
"นัดรถ",
"วันที่จับ",
"เวลาจับ",
"ออกฟาร์ม",
"ระยะทาง",
"ไป-กลับ",
"ความเร็ว",
"เวลาขนส่ง_(น.)ฐาน_100",
"เวลาขนส่ง_(ชม.)",
"เอกสาร",
"ราดน้ำ",

"เวลาจับ_(h:mm)",
"เวลาถึง_รง.(h:mm)",

"remark",
"culled_swine",
"factory",
]);

/** ฟิลด์ชนิดเวลา (TIME) */
const TIME_FIELDS = new Set([
"delivery_time",
"timetrucktofarm",
"เวลาจับ_(h:mm)",
"เวลาถึง_รง.(h:mm)",
]);

/* ======================== PARSERS ======================== */
const toDateStr = (v) => {
if (v == null || v === "" || String(v).startsWith("#")) return null;
if (typeof v === "number") {
const d = new Date(Math.round((v - 25569) * 86400 * 1000));
return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
const d = new Date(v);
return isNaN(d) ? null : d.toISOString().slice(0, 10);
};

/** แปลง input → 'HH:mm' */
const toTimeStr = (v) => {
if (v == null || v === "" || String(v).startsWith("#")) return null;

if (typeof v === "number") {
const n = v;
const frac = n % 1;
const dayFraction = frac > 0 ? frac : n <= 1 ? n : 0;
const totalMin = Math.round(dayFraction * 24 * 60);
const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
const mm = String(totalMin % 60).padStart(2, "0");
return `${hh}:${mm}`;
}

const s = String(v).trim();
let m = s.match(/^(\d{1,2}):(\d{2})$/);
if (m) return `${String(+m[1]).padStart(2, "0")}:${String(+m[2]).padStart(2, "0")}`;

m = s.match(/^(\d{1,2})(\d{2})$/); // 925, 0925
if (m) return `${String(+m[1]).padStart(2, "0")}:${String(+m[2]).padStart(2, "0")}`;

return null;
};

const toBool = (v) => {
const s = String(v ?? "").trim().toLowerCase();
if (["1", "t", "true", "y", "yes", "ใช่"].includes(s)) return true;
if (["0", "f", "false", "n", "no", "ไม่"].includes(s)) return false;
return null;
};

/** key สำหรับ upsert (ดีฟอลต์) */
function buildPk(r) {
// หมายเหตุ: กรณี index_no จะถูก override ใน doUpload()
if (r.index_no != null && r.index_no !== "") return `IDX|${r.index_no}`;
return [
r.factory ?? "",
r.delivery_date ?? "",
r.delivery_time ?? "",
r.plant ?? "",
r.house ?? "",
r.branch ?? "",
r.farm_name ?? "",
r.plate ?? "",
]
.map((x) => String(x).trim().toLowerCase())
.join("|");
}

/* ======================== COMPONENT ======================== */
export default function UploadPlanning() {
const navigate = useNavigate();

const [file, setFile] = useState(null);
const [prepRows, setPrepRows] = useState([]);
const [extraCols, setExtraCols] = useState([]);
const [loading, setLoading] = useState(false);
const [msg, setMsg] = useState("");
const [err, setErr] = useState("");

// ✅ ปิดข้อความสำเร็จอัตโนมัติภายใน 3 วินาที (error ไม่ถูกแตะ)
useEffect(() => {
if (!msg) return;
const t = setTimeout(() => setMsg(""), 3000);
return () => clearTimeout(t);
}, [msg]);

const handleFileChange = (e) => {
setErr(""); // เคลียร์ error เมื่อเลือกไฟล์ใหม่
pickFile(e);
};

async function pickFile(e) {
const f = e.target.files?.[0];
if (!f) return;
setFile(f);
setMsg("");

try {
const buf = await f.arrayBuffer();
const wb = XLSX.read(buf, { type: "array" });
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, {
header: 1,
defval: "",
blankrows: false,
});

if (!raw.length) {
setErr("ไม่พบข้อมูลในไฟล์");
return;
}

const header = (raw[0] || [])
.map(normHead)
.filter((h) => !isJunkHeader(h));
const rows = raw.slice(1);

const headerMap = header.map((h) => ({
original: h,
to: STD_MAP[h] || null,
}));

const unknown = headerMap
.filter((x) => !x.to || !ALLOWED_COLS.has(x.to))
.map((x) => x.original);
setExtraCols(unknown);

if (unknown.length) {
setPrepRows([]);
setErr(
`พบคอลัมน์ที่ไม่อยู่ในฐานข้อมูล: ${unknown.join(
", "
)} · กรุณาปรับหัวคอลัมน์ให้ตรงกับ DB`
);
return;
}

const prepared = rows
.filter((r) => r.some((v) => String(v).trim() !== ""))
.map((r) => {
const obj = {};
headerMap.forEach(({ to }, i) => {
if (!to) return;

let v = r[i];

if (to === "delivery_date") v = toDateStr(v);
if (TIME_FIELDS.has(to)) v = toTimeStr(v);
if (to === "quantity") {
const n = Number(v);
v = isNaN(n) ? null : n;
}
if (to === "culled_swine") v = toBool(v);

obj[to] = v ?? null;
});

obj.file_name = f.name;
obj.pk = buildPk(obj);
obj.created_at = new Date().toISOString();

return obj;
});

setPrepRows(prepared);
setErr("");
} catch (e1) {
console.error(e1);
setErr("อ่านไฟล์ไม่สำเร็จ หรือรูปแบบไม่ถูกต้อง");
}
}

const clearPreview = () => {
setFile(null);
setPrepRows([]);
setExtraCols([]);
setMsg("");
setErr(""); // ✅ error ถูกล้างเมื่อกดล้างพรีวิว
};

const deleteRow = (idx) => {
setPrepRows((prev) => prev.filter((_, i) => i !== idx));
};

// ✅ แก้ไขค่าในพรีวิวแบบอินไลน์
const handleCellChange = (rowIndex, colKey, value) => {
setPrepRows((prev) => {
const next = [...prev];
const row = { ...next[rowIndex] };

let v = value;

// คงรูปแบบตามชนิดที่เราใช้ตอนเตรียมข้อมูล
if (colKey === "delivery_date") v = toDateStr(value);
if (TIME_FIELDS.has(colKey)) v = toTimeStr(value);
if (colKey === "quantity") {
const n = Number(value);
v = value === "" ? null : isNaN(n) ? value : n;
}
if (colKey === "culled_swine") v = toBool(value);

row[colKey] = v;

// อัปเดต pk เมื่อฟิลด์สำคัญเปลี่ยน
if (
[
"index_no",
"factory",
"delivery_date",
"delivery_time",
"plant",
"house",
"branch",
"farm_name",
"plate",
].includes(colKey)
) {
row.pk = buildPk(row);
}

next[rowIndex] = row;
return next;
});
};

async function doUpload() {
if (!prepRows.length) {
setErr("ยังไม่มีข้อมูลสำหรับอัปโหลด");
return;
}
if (extraCols.length) {
setErr("ยังมีคอลัมน์ที่ไม่อยู่ใน DB · กรุณาแก้ Excel ให้ตรงก่อน");
return;
}

if (!window.confirm(`ยืนยันนำเข้าข้อมูลทั้งหมด ${prepRows.length} แถว?`))
return;

setLoading(true);
setMsg("");
// ไม่ล้าง error ที่นี่ — ถ้ามี ให้ผู้ใช้ปิดเอง

try {
// ---------- ตรวจ index_no เดิม + วันเปลี่ยน = insert ----------
const withIdx = prepRows.filter(
(r) => r.index_no != null && r.index_no !== ""
);
if (withIdx.length) {
const idxList = [...new Set(withIdx.map((r) => r.index_no))];

// ดึงของเดิมตาม index_no (เลือก created_at ล่าสุด)
const { data: existed, error: qErr } = await supabase
.from("planning_plan_full")
.select("id, pk, index_no, delivery_date, created_at")
.in("index_no", idxList);

if (qErr) throw qErr;

// index_no -> แถวล่าสุด
const latestByIndex = {};
(existed || []).forEach((row) => {
const key = String(row.index_no);
const cur = latestByIndex[key];
if (!cur) {
latestByIndex[key] = row;
return;
}
if (new Date(row.created_at) > new Date(cur.created_at)) {
latestByIndex[key] = row;
}
});

// ถ้าวันใหม่ != วันเดิม => ตั้ง pk แบบมีวันที่ เพื่อบังคับ insert
for (const r of withIdx) {
const latest = latestByIndex[String(r.index_no)];
if (
latest &&
latest.delivery_date &&
r.delivery_date &&
r.delivery_date !== latest.delivery_date
) {
r.pk = `IDX|${r.index_no}|${r.delivery_date}`; // insert รุ่นใหม่
} else {
r.pk = `IDX|${r.index_no}`; // update รุ่นเดิม
}
}
}
// ---------- /ตรวจ index_no ----------

const { error } = await supabase
.from("planning_plan_full")
.upsert(prepRows, { onConflict: "pk" }); // ทับเมื่อ pk ซ้ำ
if (error) throw error;

setMsg(`นำเข้าข้อมูลสำเร็จ ${prepRows.length} แถว`);
} catch (e2) {
console.error(e2);
setErr(`อัปโหลดไม่สำเร็จ: ${e2.message}`);
} finally {
setLoading(false);
}
}

const columns = useMemo(() => {
const set = new Set();
prepRows.forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
// เอาคอลัมน์ระบบไปไว้ท้าย
const order = Array.from(set).filter(
(c) => !["pk", "file_name", "file_id", "created_at"].includes(c)
);
return order.concat(["pk", "file_name", "created_at"]);
}, [prepRows]);

return (
<div className="min-h-screen bg-amber-50">
{/* Header */}
<header className="bg-amber-500 text-white">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<h1 className="text-xl font-semibold">อัปโหลดแผน (พรีวิว → นำเข้า)</h1>
<button
onClick={() => navigate("/planning")}
className="rounded-md bg-white/20 px-4 py-1 text-sm hover:bg-white/30"
>
กลับหน้าแดชบอร์ด
</button>
</div>
</header>

{/* Alerts */}
<main className="mx-auto max-w-6xl px-4 py-6">
{msg && (
<div className="mb-4 bg-green-100 text-green-700 px-4 py-2 rounded flex justify-between">
<span>{msg}</span>
<button onClick={() => setMsg("")}>×</button>
</div>
)}
{err && (
<div className="mb-4 bg-red-100 text-red-700 px-4 py-2 rounded flex justify-between">
<span>{err}</span>
<button onClick={() => setErr("")}>×</button>
</div>
)}

{/* Controls */}
<div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4 mb-6">
<div className="flex flex-col sm:flex-row gap-3 sm:items-end">
<div className="flex-1">
<label className="block text-sm text-gray-600 mb-1">เลือกไฟล์</label>
<input
type="file"
accept=".xlsx,.xls,.csv"
onChange={handleFileChange}
className="block w-full text-sm"
/>
{file && (
<p className="text-xs text-gray-600 mt-1">
ไฟล์: <b>{file.name}</b>
</p>
)}
{extraCols.length > 0 && (
<p className="text-sm text-amber-700 mt-2">
⚠️ พบคอลัมน์ที่ไม่อยู่ใน DB: <b>{extraCols.join(", ")}</b>
</p>
)}
</div>

<div className="flex gap-3">
<button
onClick={clearPreview}
className="px-4 py-2 rounded-md border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
disabled={loading}
>
ล้างพรีวิว
</button>
<button
onClick={doUpload}
className="px-4 py-2 rounded-md text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60"
disabled={loading || prepRows.length === 0}
>
{loading ? "กำลังนำเข้า..." : "นำเข้าข้อมูล"}
</button>
</div>
</div>
</div>

{/* Preview */}
<div className="bg-white rounded-xl border border-amber-200">
<div className="px-4 py-2 bg-amber-100 border-b">
<b>พรีวิวข้อมูล</b> ({prepRows.length} แถว)
</div>
<div className="overflow-x-auto">
<table className="min-w-full text-sm whitespace-nowrap">
<thead className="bg-amber-50 border-b">
<tr>
<th className="px-3 py-2 text-left">#</th>
{columns.map((c) => (
<th key={c} className="px-3 py-2 text-left">
{c}
</th>
))}
<th className="px-3 py-2"></th>
</tr>
</thead>
<tbody>
{prepRows.length ? (
prepRows.map((r, i) => (
<tr key={i} className="border-b hover:bg-amber-50">
<td className="px-3 py-2">{i + 1}</td>

{columns.map((c) => (
<td key={c} className="px-3 py-2">
{/* ระบบคอลัมน์ ไม่ให้แก้ */}
{["pk", "file_name", "created_at"].includes(c) ? (
<span className="text-gray-500">{r[c] ?? ""}</span>
) : (
<input
className="border rounded px-2 py-1 w-44"
value={r[c] ?? ""}
onChange={(e) =>
handleCellChange(i, c, e.target.value)
}
placeholder={c}
/>
)}
</td>
))}

<td className="px-3 py-2">
<button
onClick={() => deleteRow(i)}
className="text-red-600 hover:underline"
>
ลบแถว
</button>
</td>
</tr>
))
) : (
<tr>
<td
colSpan={columns.length + 2}
className="px-3 py-4 text-gray-500"
>
ยังไม่มีข้อมูลพรีวิว
</td>
</tr>
)}
</tbody>
</table>
</div>
</div>
</main>
</div>
);
}
