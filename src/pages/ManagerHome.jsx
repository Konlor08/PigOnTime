// src/pages/ManagerHome.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";

export default function ManagerHome() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore error
    }
    try {
      localStorage.removeItem("user");
    } catch {
      // ignore
    }
    navigate("/login", { replace: true });
  };

  const Card = ({ to, title, desc }) => (
    <Link
      to={to}
      className="block bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 transition p-5"
    >
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="text-gray-600 text-sm mt-1">{desc}</p>
    </Link>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="w-8 h-8" alt="logo" />
            <h1 className="text-2xl font-extrabold">
              Pig On Time — Manager
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-bold mb-1">แดชบอร์ดรวม</h2>
          <p className="text-gray-600 text-sm">
            สำหรับผู้จัดการดูสถานะภาพรวมทุกกิจกรรม (อ่านอย่างเดียว)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            to="/transport-tracking"
            title="สถานะการขนส่ง (ทุก SITE)"
            desc="ดูคิวขนส่ง, พิกัดรถ, เวลาเข้า–ออกฟาร์ม/โรงงาน และปัญหาที่บันทึกจากทุกบทบาท"
          />
          {/* ถ้าอนาคตมี report อื่น ๆ ค่อยเพิ่มการ์ดใหม่ได้ */}
        </div>
      </main>
    </div>
  );
}
