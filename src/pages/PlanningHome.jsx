import { Link, useNavigate } from "react-router-dom";
import supabase from "../supabaseClient"; // ตรวจ path ให้ถูกกับโปรเจกต์ของคุณ

export default function PlanningHome() {
  const navigate = useNavigate();

  async function handleLogout() {
    // ลบ try-catch ที่ไม่ใช้ 'e' เพื่อแก้ warning no-unused-vars
    await supabase.auth.signOut();
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  const Card = ({ to, title, desc }) => (
    <Link
      to={to}
      className="block bg-white rounded-xl border border-amber-200 shadow-sm hover:shadow-md hover:bg-amber-50 transition p-6"
    >
      <h3 className="text-lg font-semibold text-amber-700">{title}</h3>
      <p className="text-gray-600 text-sm mt-2">{desc}</p>
    </Link>
  );

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="bg-amber-500 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            Planning Dashboard
          </h1>
          <button
            onClick={handleLogout}
            className="rounded-md bg-white/20 px-4 py-2 text-sm hover:bg-white/30"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
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
        </div>
      </main>
    </div>
  );
}
