import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import supabase from "../supabaseClient";

export default function PlanningHome() {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  // โหลดครั้งแรกเท่านั้น (ไม่ตั้ง interval)
  useEffect(() => {
    (async () => {
      const { count, error } = await supabase
        .from("farms")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!error) setPendingCount(count ?? 0);
    })();
  }, []);

  // ฟังสัญญาณแบบไม่ยิง DB เพิ่ม
  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel("pending-farms");
      bc.onmessage = (ev) => {
        const msg = ev.data || {};
        if (msg.type === "activated") {
          // ฟาร์มถูกอนุมัติ 1 ตัว → ลด badge ทันที
          setPendingCount((c) => Math.max(0, c - 1));
        } else if (msg.type === "created") {
          // มีฟาร์มใหม่ (pending) จากการอัปโหลดคิว → เพิ่ม badge
          setPendingCount((c) => c + 1);
        }
      };
    } catch {}
    return () => bc?.close();
  }, []);

  const Card = ({ to, title, desc, badge }) => (
    <Link
      to={to}
      className="relative block bg-white rounded-xl border border-amber-200 shadow-sm hover:shadow-md hover:bg-amber-50 transition p-6"
    >
      <h3 className="text-lg font-semibold text-amber-700 flex items-center gap-2">
        {title}
        {badge}
      </h3>
      <p className="text-gray-600 text-sm mt-2">{desc}</p>
    </Link>
  );

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-amber-500 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Planning Dashboard</h1>
          <button
            onClick={handleLogout}
            className="rounded-md bg-white/20 px-4 py-2 text-sm hover:bg-white/30"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            to="/planning/upload"
            title="Plan upload (Excel/CSV)"
            desc="นำเข้าแผนขนส่งล่าสุดจากไฟล์ Excel/CSV พร้อมพรีวิวข้อมูลก่อนบันทึก"
          />
          <Card
            to="/planning/issues"
            title="แจ้งปัญหาการทำงาน"
            desc="บันทึกและติดตามปัญหาที่พบระหว่างปฏิบัติงาน อ้างอิงตามแผนที่อัปโหลด"
          />
          <Card
            to="/planning/transport"
            title="สถานะการขนส่ง"
            desc="ติดตามความคืบหน้าการขนส่ง เทียบกับแผนงานที่อัปโหลด"
          />
          <Card
            to="/planning/farm-activate"
            title="ฟาร์มใหม่รอตรวจสอบ (Pending)"
            desc="ตรวจรายการฟาร์มรอ Activate เพื่อใช้งานในระบบ"
            badge={
              pendingCount > 0 ? (
                <span className="inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs px-2 py-0.5">
                  {pendingCount}
                </span>
              ) : null
            }
          />
        </div>
      </main>
    </div>
  );
}
