// src/pages/AHReportIssuesLite.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../supabaseClient";

/* ---------- Banner ---------- */
function Banner({ type = "info", children }) {
const color =
type === "error"
? "border-red-200 bg-red-50 text-red-700"
: "border-emerald-200 bg-emerald-50 text-emerald-700";
return <div className={`mb-4 rounded-lg border px-3 py-2 ${color}`}>{children}</div>;
}

/* ---------- utils ---------- */
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const plusDaysISO = (n) => {
const d = new Date();
d.setDate(d.getDate() + n);
return iso(d);
};
const minusDaysISO = (n) => plusDaysISO(-n);
const isImage = (mt) => /^image\//i.test(mt || "");
const isPdf = (mt) => /^application\/pdf$/i.test(mt || "");

function farmLabel(f) {
if (!f) return "";
const code = [f.plant, f.branch, f.house].filter(Boolean).join(" / ");
return `${code} ${f.farm_name || ""}`.trim();
}

/* ---------- compress image ≤1MB ---------- */
async function fileToImage(file) {
const dataUrl = await new Promise((res, rej) => {
const fr = new FileReader();
fr.onload = () => res(fr.result);
fr.onerror = rej;
fr.readAsDataURL(file);
});
const img = new Image();
await new Promise((res, rej) => {
img.onload = res;
img.onerror = rej;
img.src = dataUrl;
});
return img;
}
async function compressImage(file, { maxEdge = 1600, targetBytes = 1_000_000, q0 = 0.85 } = {}) {
const img = await fileToImage(file);
let w = img.width,
h = img.height;
if (Math.max(w, h) > maxEdge) {
if (w >= h) {
h = Math.round(h * (maxEdge / w));
w = maxEdge;
} else {
w = Math.round(w * (maxEdge / h));
h = maxEdge;
}
}
const canvas = document.createElement("canvas");
canvas.width = w;
canvas.height = h;
canvas.getContext("2d").drawImage(img, 0, 0, w, h);
const toBlob = (q) => new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
let q = q0,
blob = await toBlob(q);
while (blob && blob.size > targetBytes && q > 0.5) {
q -= 0.07;
blob = await toBlob(q);
}
let tries = 0;
while (blob && blob.size > targetBytes && tries < 2) {
tries++;
canvas.width = Math.round(canvas.width * 0.85);
canvas.height = Math.round(canvas.height * 0.85);
canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
q = Math.max(0.5, q - 0.07);
blob = await toBlob(q);
}
if (!blob) throw new Error("แปลงรูปไม่สำเร็จ");
if (blob.size > targetBytes) throw new Error(`ไฟล์รูปยังเกิน 1MB (${Math.round(blob.size / 1024)} KB)`);
return new File([blob], `${(file.name || "image").split(".")[0]}.jpg`, { type: "image/jpeg" });
}

/* ---------- คิวแสดงเป็นแผน/เที่ยว (มีแถบสีบนการ์ด) ---------- */
function SearchBox({ list, value, onChange }) {
const [q, setQ] = useState("");
const results = useMemo(() => {
const s = q.trim().toLowerCase();
if (!s) return list;
return list.filter((x) =>
[x.date, x.factory, farmLabel(x.farm), x.plan_id].join(" ").toLowerCase().includes(s)
);
}, [q, list]);

return (
<div className="rounded-xl border bg-white/90 p-3">
<input
value={q}
onChange={(e) => setQ(e.target.value)}
placeholder="ค้นหา (วันที่/ฟาร์ม/โรงงาน/รหัสแผน)"
className="mb-2 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
/>
<div className="max-h-80 overflow-auto space-y-2">
{results.map((g) => (
<button
key={g.plan_id}
onClick={() => onChange(g)}
type="button"
className={`block w-full text-left rounded-md px-3 pb-2 pt-0 border overflow-hidden ${
value?.plan_id === g.plan_id ? "ring-2 ring-emerald-500" : ""
}`}
>
<div className={`h-1 w-full mb-2 ${g.has_issue ? "bg-amber-500" : "bg-emerald-600"}`} />
<div className="font-medium">
{g.date} • {farmLabel(g.farm)}
</div>
<div className="text-xs text-gray-600">
โรงงาน: {g.factory || "-"} · แผน #{g.plan_id}
{g.has_issue ? " · มีบันทึกปัญหาแล้ว" : ""}
</div>
</button>
))}
{!results.length && <div className="text-center text-gray-500 py-6">ไม่พบข้อมูล</div>}
</div>
</div>
);
}

/* ---------- Page ---------- */
export default function AHReportIssuesLite() {
// อ่านผู้ใช้จาก localStorage (โหมดทดสอบ)
let me = null;
try {
me = JSON.parse(localStorage.getItem("user") || "null");
} catch {
me = null;
}

const [err, setErr] = useState("");
const [msg, setMsg] = useState("");
const [busy, setBusy] = useState(false);

const [queue, setQueue] = useState([]); // แผน/เที่ยว
const [sel, setSel] = useState(null); // รายการที่เลือก

// แบบฟอร์มปัญหา
const [issueId, setIssueId] = useState(null);
const [title, setTitle] = useState("");
const [detail, setDetail] = useState("");
const [severity, setSeverity] = useState("medium");
const [status, setStatus] = useState("open");
const [files, setFiles] = useState([]); // {file, previewUrl, mime}
const [attached, setAttached] = useState([]); // จาก DB

const maxFiles = 3;

const onAnyAction = (fn) => async (...args) => {
if (err) setErr(""); // เคลียร์ error เมื่อกดปุ่มใดๆ
return fn?.(...args);
};

/* โหลดคิว: ย้อนหลัง 7 → ล่วงหน้า 7 วัน, ต่อ "แผน/เที่ยว" */
const loadQueue = useCallback(async () => {
setErr("");
setBusy(true);
try {
if (!me?.id) throw new Error("ไม่พบผู้ใช้ปัจจุบัน");

// 1) ฟาร์มที่ฉันดูแล
const { data: rel, error: e1 } = await supabase
.from("ah_farm_relations")
.select("farm_id, farms(id, plant, branch, house, farm_name)")
.eq("ah_id", me.id);
if (e1) throw e1;
const myFarms = (rel || []).map((r) => r.farms).filter(Boolean);
const farmById = new Map(myFarms.map((f) => [f.id, f]));


// 2) แผนช่วง -7..+7
const from = minusDaysISO(7);
const to = plusDaysISO(7);
const { data: plans, error: e2 } = await supabase
.from("planning_plan_full")
.select("id, delivery_date, farm_id, plant, branch, house, farm_name, factory")
.gte("delivery_date", from)
.lte("delivery_date", to);
if (e2) throw e2;

// จับคู่ทีละแผน/เที่ยว
const items = [];
for (const p of plans || []) {
let f = p.farm_id ? farmById.get(p.farm_id) : null;
if (!f) {
  f = myFarms.find(
    (x) =>
      (x.plant || "") === (p.plant || "") &&
      (x.branch || "") === (p.branch || "") &&
    (x.house || "") === (p.house || "") &&
    (x.farm_name || "") === (p.farm_name || "")
  );
}
if (!f) continue;
items.push({
plan_id: p.id,
date: iso(p.delivery_date),
farm: f,
factory: p.factory || null,
});
}
// มีประวัติปัญหาแล้วหรือยัง
const { data: existed } = await supabase
.from("plan_issues")
.select("plan_id")
.in("plan_id", items.map((x) => x.plan_id));
const has = new Set((existed || []).map((x) => x.plan_id));

setQueue(
items
.map((x) => ({ ...x, has_issue: has.has(x.plan_id) }))
.sort((a, b) => a.date.localeCompare(b.date) || a.plan_id - b.plan_id)
);
} catch (e) {
setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
} finally {
setBusy(false);
}
}, [me?.id]);

useEffect(() => {
loadQueue();
}, [loadQueue]);

/* เมื่อเลือกคิว → โหลด issue ถ้ามี */
useEffect(() => {
const go = async () => {
setIssueId(null);
setTitle("");
setDetail("");
setSeverity("medium");
setStatus("open");
setFiles([]);
setAttached([]);

if (!sel) return;

const { data: iss } = await supabase
.from("plan_issues")
.select("id, title, detail, severity, status")
.eq("plan_id", sel.plan_id)
.maybeSingle();

if (iss) {
setIssueId(iss.id);
setTitle(iss.title || "");
setDetail(iss.detail || "");
setSeverity(iss.severity || "medium");
setStatus(iss.status || "open");

const { data: fs } = await supabase
.from("plan_issue_files")
.select("id, file_url, mime_type, file_name, file_bytes")
.eq("issue_id", iss.id);
setAttached(fs || []);
}
};
go();
}, [sel]);

/* เลือกไฟล์ (รูปย่อ ≤1MB; PDF ได้) */
const onPick = async (e) => {
const chosen = Array.from(e.target.files || []);
e.target.value = "";
const remain = maxFiles - (files.length + attached.length);
if (remain <= 0) {
setErr(`แนบไฟล์ได้สูงสุด ${maxFiles} ไฟล์ต่อรายการ`);
return;
}
try {
const out = [];
for (const f of chosen.slice(0, remain)) {
const mt = f.type || "";
if (!(isImage(mt) || isPdf(mt))) continue;
let ff = f;
if (isImage(mt)) ff = await compressImage(f);
out.push({ file: ff, previewUrl: isImage(ff.type) ? URL.createObjectURL(ff) : null, mime: ff.type });
}
setFiles((old) => [...old, ...out]);
} catch (ex) {
setErr(ex.message || "เตรียมไฟล์ไม่สำเร็จ");
}
};

const removeAttached = async (id) => {
setAttached((old) => old.filter((x) => x.id !== id));
await supabase.from("plan_issue_files").delete().eq("id", id);
};

/* บันทึก (insert หรือ update) + อัปโหลดไฟล์ใหม่ */
const onSave = async () => {
setErr("");
setMsg("");

if (!sel) return setErr("ยังไม่ได้เลือกรายการ");
if (!title.trim()) return setErr("กรุณากรอกหัวข้อปัญหา");

setBusy(true);
try {
let iid = issueId;
if (!iid) {
const { data: ins, error: ei } = await supabase
.from("plan_issues")
.insert({
plan_id: sel.plan_id,
delivery_date: sel.date,
farm_id: sel.farm.id,
ah_id: me?.id || null,
title: title.trim(),
detail: detail || null,
severity,
status,
})
.select("id")
.single();
if (ei) throw ei;
iid = ins.id;
setIssueId(iid);
} else {
const { error: eu } = await supabase
.from("plan_issues")
.update({
title: title.trim(),
detail: detail || null,
severity,
status,
ah_id: me?.id || null,
})
.eq("id", iid);
if (eu) throw eu;
}

// อัปโหลดไฟล์ที่เพิ่งเลือก
for (const it of files) {
const f = it.file;
const ext = isPdf(f.type) ? "pdf" : "jpg";
const fileName = `${crypto.randomUUID()}.${ext}`;
const path = `${iid}/${fileName}`;

const { error: eUp } = await supabase.storage
.from("issue-files")
.upload(path, f, { contentType: f.type, upsert: false, cacheControl: "3600" });
if (eUp) throw eUp;

const { data: pub } = await supabase.storage.from("issue-files").getPublicUrl(path);

const { error: eRec } = await supabase.from("plan_issue_files").insert({
issue_id: iid,
file_url: pub.publicUrl,
file_name: path,
mime_type: f.type,
file_bytes: f.size,
});
if (eRec) throw eRec;
}

// โหลดไฟล์แนบล่าสุดกลับมาโชว์
const { data: fs2 } = await supabase
.from("plan_issue_files")
.select("id, file_url, mime_type, file_name, file_bytes")
.eq("issue_id", iid);
setAttached(fs2 || []);
setFiles([]);

// อัปเดตสถานะว่ามีปัญหาแล้วในคิว
setQueue((old) => old.map((x) => (x.plan_id === sel.plan_id ? { ...x, has_issue: true } : x)));

setMsg("บันทึก/อัปเดตปัญหาสำเร็จ");
setTimeout(() => setMsg(""), 3000);
} catch (e) {
setErr(e.message || "บันทึกไม่สำเร็จ"); // ค้างไว้จนกดปุ่มใดๆ
} finally {
setBusy(false);
}
};

return (
<div className="min-h-screen bg-emerald-50">
<header className="bg-emerald-600 text-white">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<h1 className="text-2xl font-semibold">แจ้งปัญหา (อ้างอิงแผน) — ย้อนหลัง 7 วัน ↔ ล่วงหน้า 7 วัน</h1>
<Link to="/ah" className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20">
กลับหน้า Animal husbradry
</Link>
</div>
</header>

<main className="mx-auto max-w-6xl px-4 py-6">
{err && <Banner type="error">{err}</Banner>}
{msg && <Banner type="success">{msg}</Banner>}

<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
{/* คิวราย "แผน/เที่ยว" */}
<div className="md:col-span-2">
<div className="font-semibold mb-2">
คิวตามเงื่อนไขวันที่ (วันนี้: {todayISO()}) — แสดงเฉพาะ -7..+7 วัน
</div>
<SearchBox list={queue} value={sel} onChange={setSel} />
{busy && <div className="text-gray-500 mt-3">กำลังโหลด…</div>}
{!busy && !queue.length && <div className="text-gray-500 mt-3">ไม่มีคิวในช่วงเงื่อนไข</div>}
</div>

{/* ฟอร์มแจ้งปัญหา */}
<div className="space-y-3">
<div className="rounded-xl border bg-white/90 p-3">
<div className="font-semibold mb-2">รายละเอียดปัญหา</div>

<div className="text-sm text-gray-700 mb-2">
วันที่: <b>{sel?.date || "-"}</b>
<br />
ฟาร์ม: <b>{sel ? farmLabel(sel.farm) : "-"}</b>
<br />
โรงงาน: <b>{sel?.factory || "-"}</b> · แผน #{sel?.plan_id ?? "-"}
</div>

<label className="block text-sm text-gray-600">หัวข้อปัญหา</label>
<input
value={title}
onChange={(e) => setTitle(e.target.value)}
placeholder="เช่น ถนนลื่น มีน้ำท่วม/รถติดหนัก ฯลฯ"
className="mb-3 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
/>

<label className="block text-sm text-gray-600">รายละเอียด</label>
<textarea
value={detail}
onChange={(e) => setDetail(e.target.value)}
rows={3}
className="mb-3 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
placeholder="อธิบายเพิ่มเติม"
/>

<div className="grid grid-cols-2 gap-3 mb-3">
<div>
<label className="block text-sm text-gray-600">ความรุนแรง</label>
<select
value={severity}
onChange={(e) => setSeverity(e.target.value)}
className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
>
<option value="low">ต่ำ</option>
<option value="medium">ปานกลาง</option>
<option value="high">สูง</option>
</select>
</div>
<div>
<label className="block text-sm text-gray-600">สถานะ</label>
<select
value={status}
onChange={(e) => setStatus(e.target.value)}
className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
>
<option value="open">เปิด</option>
<option value="resolved">แก้ไขแล้ว</option>
</select>
</div>
</div>

<label className="block text-sm text-gray-600">ไฟล์แนบ (รูป/PDF สูงสุด 3)</label>
<input
type="file"
accept="application/pdf,image/*"
multiple
onChange={onAnyAction(onPick)}
className="mb-2 block w-full text-sm"
disabled={!sel}
/>
<div className="text-xs text-gray-600 mb-2">ไฟล์รูปจะย่ออัตโนมัติไม่เกิน 1MB</div>

{/* ไฟล์ในเครื่องที่เพิ่งเลือก */}
{files.length > 0 && (
<div className="flex flex-wrap gap-2 mb-2">
{files.map((it, i) => (
<div key={i} className="w-20 h-20 rounded border overflow-hidden flex items-center justify-center">
{isImage(it.mime) ? <img src={it.previewUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-xs">PDF</span>}
</div>
))}
</div>
)}

{/* ไฟล์ที่เคยแนบแล้ว */}
{attached.length > 0 && (
<div className="mb-2">
<div className="text-sm font-medium mb-1">ไฟล์ที่แนบแล้ว</div>
<div className="flex flex-wrap gap-2">
{attached.map((f) => (
<div key={f.id} className="flex items-center gap-2 text-xs border rounded px-2 py-1 bg-gray-50">
<a href={f.file_url} target="_blank" rel="noreferrer" className="underline">ดูไฟล์</a>
<button className="text-red-600" onClick={onAnyAction(() => removeAttached(f.id))}>ลบ</button>
</div>
))}
</div>
</div>
)}

<div className="flex gap-2">
<button
type="button"
onClick={onAnyAction(onSave)}
className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
disabled={busy || !sel || !title.trim()}
>
บันทึก / อัปเดต
</button>
<button
type="button"
onClick={onAnyAction(() => { setTitle(""); setDetail(""); setSeverity("medium"); setStatus("open"); setFiles([]); })}
className="rounded-md bg-gray-200 px-4 py-2 hover:bg-gray-300"
>
ล้างฟอร์ม
</button>
</div>

<div className="text-xs text-gray-500 mt-2">
* คิวจะหายไปอัตโนมัติเมื่อเลยช่วงวันที่ -7 ถึง +7 (ตามวันนี้)
</div>
</div>
</div>
</div>
</main>
</div>
);
}
