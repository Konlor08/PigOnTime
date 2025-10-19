// src/pages/AHPlanStatus.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../supabaseClient";

/* ---------- utils ---------- */
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const plusDaysISO = (n) => {
const d = new Date();
d.setDate(d.getDate() + n);
return iso(d);
};
const minusDaysISO = (n) => plusDaysISO(-n);

function farmLabel(f) {
if (!f) return "";
const code = [f.plant, f.branch, f.house].filter(Boolean).join(" / ");
return `${code} ${f.farm_name || ""}`.trim();
}

function Banner({ type = "info", children }) {
const color =
type === "error"
? "border-red-200 bg-red-50 text-red-700"
: "border-emerald-200 bg-emerald-50 text-emerald-700";
return <div className={`mb-4 rounded-lg border px-3 py-2 ${color}`}>{children}</div>;
}

/* ---------- กล่องค้นหา/เลือกคิว ---------- */
function SearchBox({ list, q, setQ, onlyPending, setOnlyPending }) {
return (
<div className="rounded-xl border bg-white/90 p-3">
<div className="flex flex-col md:flex-row gap-3 md:items-center mb-2">
<input
value={q}
onChange={(e) => setQ(e.target.value)}
placeholder="ค้นหา (วันที่/ฟาร์ม/โรงงาน/รหัสแผน)"
className="flex-1 rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
/>
<label className="inline-flex items-center gap-2 text-sm">
<input
type="checkbox"
checked={onlyPending}
onChange={(e) => setOnlyPending(e.target.checked)}
/>
แสดงเฉพาะคิวที่ยังไม่เสร็จ
</label>
</div>

<div className="max-h-96 overflow-auto space-y-2">
{list.map((g) => {
const colorBar = g.open_issues > 0 ? "bg-red-500" : g.has_album ? "bg-emerald-600" : "bg-amber-500";
return (
<div key={g.plan_id} className="rounded-md border px-3 pb-2 pt-0">
<div className={`h-1 w-full mb-2 ${colorBar}`} />
<div className="font-medium">{g.date} • {farmLabel(g.farm)}</div>
<div className="text-xs text-gray-600">
โรงงาน: {g.factory || "-"} · แผน #{g.plan_id}
{g.has_album ? " · มีอัลบั้ม" : " · ยังไม่มีอัลบั้ม"}
{g.open_issues > 0 ? ` · Issue เปิด ${g.open_issues}` : ""}
</div>
</div>
);})}
{!list.length && <div className="text-center text-gray-500 py-6">ไม่พบข้อมูล</div>}
</div>
</div>
);
}

/* ---------- หน้าแสดงสถานะ ---------- */
export default function AHPlanStatus() {
// ผู้ใช้ (อ่านจาก localStorage)
let me = null;
try { me = JSON.parse(localStorage.getItem("user") || "null"); } catch { me = null; }

const [err, setErr] = useState("");
const [busy, setBusy] = useState(false);

// ช่วงวันที่ (ค่าเริ่มต้น: วันนี้-7 ถึง วันนี้+7) — ปรับได้เอง
const [dFrom, setDFrom] = useState(minusDaysISO(7));
const [dTo, setDTo] = useState(plusDaysISO(7));

// คิวทั้งหมด (หลังรวมฟิลด์สถานะ)
const [rows, setRows] = useState([]);

// ควบคุมการค้นหา/กรอง
const [q, setQ] = useState("");
const [onlyPending, setOnlyPending] = useState(true);

/* โหลดคิว + สถานะ */
const loadAll = useCallback(async () => {
setErr("");
setBusy(true);
try {
if (!me?.id) throw new Error("ไม่พบผู้ใช้ปัจจุบัน");

// 1) ฟาร์มที่ผูกกับฉัน
const { data: rel, error: eRel } = await supabase
.from("ah_farm_relations")
.select("farm_id, farms(id, plant, branch, house, farm_name)")
.eq("ah_id", me.id);
if (eRel) throw eRel;
const myFarms = (rel || []).map((r) => r.farms).filter(Boolean);

// 2) แผนตามช่วงวันที่
const { data: plans, error: ePlan } = await supabase
.from("planning_plan_full")
.select("id, delivery_date, plant, branch, house, farm_name, factory")
.gte("delivery_date", dFrom)
.lte("delivery_date", dTo);
if (ePlan) throw ePlan;

// 3) จับคู่เฉพาะฟาร์มที่ฉันดูแล
const items = [];
for (const p of plans || []) {
const f = myFarms.find(
(x) =>
(x.plant || "") === (p.plant || "") &&
(x.branch || "") === (p.branch || "") &&
(x.house || "") === (p.house || "") &&
(x.farm_name || "") === (p.farm_name || "")
);
if (!f) continue;
items.push({
plan_id: p.id,
date: iso(p.delivery_date),
farm: f,
factory: p.factory || null,
});
}

// 4) เช็คสถานะจาก album + issues
// 4.1 อัลบั้ม: คีย์ <YYYY-MM-DD>::<farm_id>
const groupKeys = items.map((x) => `${x.date}::${x.farm.id}`);
const { data: albums } = await supabase
.from("plan_route_albums")
.select("group_key")
.in("group_key", groupKeys);
const albumSet = new Set((albums || []).map((a) => a.group_key));

// 4.2 issues เปิดอยู่ ของแผนเหล่านี้
const planIds = items.map((x) => x.plan_id);
const { data: issues } = await supabase
.from("plan_issues")
.select("plan_id, status")
.in("plan_id", planIds);
const openCount = new Map(); // plan_id -> count
for (const it of issues || []) {
if (String(it.status || "").toLowerCase() !== "resolved") {
openCount.set(it.plan_id, (openCount.get(it.plan_id) || 0) + 1);
}
}

// 5) รวมฟิลด์สถานะ
const merged = items.map((x) => {
const has_album = albumSet.has(`${x.date}::${x.farm.id}`);
const open_issues = openCount.get(x.plan_id) || 0;
const pending = !has_album || open_issues > 0;
return { ...x, has_album, open_issues, pending };
});

setRows(
merged.sort((a, b) => a.date.localeCompare(b.date) || a.plan_id - b.plan_id)
);
} catch (e) {
setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
} finally {
setBusy(false);
}
}, [me?.id, dFrom, dTo]);

useEffect(() => {
loadAll();
}, [loadAll]);

/* สร้างรายการหลังกรอง/ค้นหา */
const displayList = useMemo(() => {
const s = q.trim().toLowerCase();
let arr = rows;
if (onlyPending) arr = arr.filter((x) => x.pending);
if (s) {
arr = arr.filter((x) =>
[x.date, x.factory, x.plan_id, farmLabel(x.farm)]
.join(" ")
.toLowerCase()
.includes(s)
);
}
return arr;
}, [rows, q, onlyPending]);

return (
<div className="min-h-screen bg-emerald-50">
<header className="bg-emerald-600 text-white">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<h1 className="text-2xl font-semibold">สถานะการจัดส่งตามแผน</h1>
<Link to="/ah" className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20">
กลับหน้า Animal husbrandry
</Link>
</div>
</header>

<main className="mx-auto max-w-6xl px-4 py-6">
{err && <Banner type="error">{err}</Banner>}

<div className="rounded-xl border bg-white/90 p-3 mb-4">
<div className="grid grid-cols-1 md:grid-cols-4 gap-3">
<div>
<label className="block text-sm text-gray-600">ตั้งแต่วันที่</label>
<input
type="date"
value={dFrom}
onChange={(e) => setDFrom(e.target.value)}
className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
/>
</div>
<div>
<label className="block text-sm text-gray-600">ถึงวันที่</label>
<input
type="date"
value={dTo}
onChange={(e) => setDTo(e.target.value)}
className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
/>
</div>
<div className="md:col-span-2 flex items-end">
<button
type="button"
onClick={loadAll}
className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
disabled={busy}
>
โหลดข้อมูล
</button>
<div className="ml-3 text-sm text-gray-600">
วันนี้: <b>{todayISO()}</b>
</div>
</div>
</div>
</div>

<SearchBox
list={displayList}
q={q}
setQ={setQ}
onlyPending={onlyPending}
setOnlyPending={setOnlyPending}
/>

{busy && <div className="text-gray-500 mt-3">กำลังโหลด…</div>}
{!busy && !displayList.length && (
<div className="text-gray-500 mt-3">ไม่มีคิวตามเงื่อนไข</div>
)}
</main>
</div>
);
}
