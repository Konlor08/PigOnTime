import React, { useState } from "react";
import supabase from "../supabaseClient";

export default function TestWriteAlbum() {
const [log, setLog] = useState([]);
const push = (x) => setLog((s) => [String(x), ...s]);

const todayISO = () => new Date().toISOString().slice(0, 10);

const testInsert = async () => {
setLog([]);

// 1) เอา uid จาก session (สำคัญสุด)
const { data: sess, error: eSess } = await supabase.auth.getSession();
if (eSess) return push(`❌ getSession: ${eSess.message}`);
const uid = sess?.session?.user?.id;
if (!uid) return push("❌ ไม่มี session (uid) — กรุณา login");

push(`✅ uid = ${uid}`);

// 2) หา farm_id ตัวแรกของ AH คนนี้
const { data: rel, error: eRel } = await supabase
.from("ah_farm_relations")
.select("farm_id, farms(id, plant, branch, house, farm_name)")
.eq("ah_id", uid) // ถ้าระบบของคุณเก็บ app_users.id == auth.uid()
.limit(1)
.maybeSingle();

if (eRel) return push(`❌ ah_farm_relations: ${eRel.message}`);
const farm = rel?.farms;
if (!farm?.id) return push("❌ ไม่พบฟาร์มที่ผูกกับผู้ใช้นี้ (ทดสอบต่อไม่ได้)");

push(`✅ farm_id = ${farm.id}`);

// 3) สร้าง group_key และ insert อัลบั้มจริง
const group_key = `${todayISO()}::${farm.id}`;
push(`ℹ︎ group_key = ${group_key}`);

const { data: inserted, error: eIns } = await supabase
.from("plan_route_albums")
.insert({
group_key,
delivery_date: todayISO(),
farm_id: farm.id,
ah_id: uid, // 🔴 สำคัญ: ต้องเท่ากับ auth.uid() เพื่อผ่าน RLS
})
.select("id, created_at")
.maybeSingle();

if (eIns) return push(`❌ INSERT plan_route_albums: ${eIns.message}`);

push(`✅ INSERT OK: album_id=${inserted.id} at ${inserted.created_at}`);
};

const testDelete = async () => {
setLog([]);
const { data: sess } = await supabase.auth.getSession();
const uid = sess?.session?.user?.id;
if (!uid) return push("❌ ไม่มี session (uid)");

// ลบเฉพาะอัลบั้มทดสอบของวันนี้ (ความเสี่ยงต่ำ)
const today = new Date().toISOString().slice(0, 10);
const { data: target } = await supabase
.from("plan_route_albums")
.select("id, group_key")
.like("group_key", `${today}::%`)
.eq("ah_id", uid)
.order("created_at", { ascending: false })
.limit(1)
.maybeSingle();

if (!target?.id) return push("ℹ︎ ไม่เจออัลบั้มทดสอบของวันนี้");

const { error: eDel } = await supabase
.from("plan_route_albums")
.delete()
.eq("id", target.id);

if (eDel) return push(`❌ DELETE: ${eDel.message}`);
push(`🧹 ลบอัลบั้มทดสอบแล้ว: ${target.group_key}`);
};

return (
<div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
<h2>🧪 Test: เขียนจริงลง plan_route_albums</h2>
<div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
<button onClick={testInsert}>💾 สร้างอัลบั้มทดสอบ (วันนี้)</button>
<button onClick={testDelete}>🧹 ลบอัลบั้มทดสอบล่าสุดของฉัน</button>
</div>
<pre
style={{
marginTop: 12,
padding: 12,
background: "#f6f7f8",
border: "1px solid #ddd",
borderRadius: 8,
maxWidth: 800,
whiteSpace: "pre-wrap",
}}
>
{log.join("\n")}
</pre>
</div>
);
}
