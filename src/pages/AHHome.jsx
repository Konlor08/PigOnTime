// src/pages/AHHome.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function AHHome() {
  const navigate = useNavigate();

  // อ่าน user ไว้โชว์มุมขวา
  let currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    currentUser = null;
  }

  const handleLogout = () => {
    try {
      localStorage.removeItem("user");
    } catch {
      /* noop */
    }
    navigate("/login", { replace: true });
  };

  // การ์ดสำหรับ "ลิงก์ไปหน้าอื่น"
  const CardLink = ({ to, title, desc }) => (
    <Link
      to={to}
      className="w-full block rounded-xl border bg-white/90 shadow-sm hover:shadow-md p-6 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
      aria-label={title}
    >
      <div className="text-xl font-bold text-emerald-700">{title}</div>
      <div className="text-gray-600 mt-2">{desc}</div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-emerald-50">
      {/* Header */}
      <header className="bg-emerald-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Pig On Time"
              className="h-8 w-8 rounded-sm select-none"
              draggable={false}
            />
            <h1 className="text-2xl font-semibold">Animalhusbandry Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="hidden sm:block text-sm text-white/90">
                <div className="font-semibold leading-tight">
                  {currentUser.full_name || "Animal Husbandry"}
                </div>
                <div className="text-white/70 leading-tight">
                  {String(currentUser.role || "animalhusbandry").toUpperCase()}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 mt-6 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ไปหน้าเพิ่มฟาร์ม */}
          <CardLink
            to="/ah/farm/add"
            title="เพิ่มฟาร์ม (ครั้งละหนึ่ง)"
            desc="บันทึกฟาร์มใหม่แบบกรอกทีละรายการ"
          />

          {/* ไปหน้าจัดการความสัมพันธ์ AH ↔ ฟาร์ม */}
          <CardLink
            to="/ah/link/farms"
            title="เชื่อมโยงฉัน ↔ ฟาร์ม/โรงงาน"
            desc="ผูก-แก้ไข ความสัมพันธ์ระหว่างผู้ใช้กับฟาร์ม"
          />

          {/* ไปหน้าจัดการความสัมพันธ์ AH ↔ ฟาร์ม ↔ โรงงาน */}
          <CardLink
            to="/ah/link/farm-factory"
            title="เชื่อมโยง ฟาร์ม ↔ โรงงาน"
            desc="ผูก-แก้ไข ความสัมพันธ์ระหว่างฟาร์ม/โรงงานโดยผู้ใช้"
          />

          {/* การ์ดอื่นๆ */}
          <CardLink
            to="/ah/farm/gps"
            title="อัปเดตพิกัดฟาร์ม (GPS มือถือ)"
            desc="บันทึก lat/long ของฟาร์มจากตำแหน่งปัจจุบัน"
          />

          <CardLink
            to="/ah/factory/gps"
            title="อัปเดตพิกัดโรงงาน"
            desc="บันทึก,แก้ไข lat/long ของโรงงาน"
          />

          <CardLink
            to="/ah/route/photos"
            title="อัปโหลดรูปสภาพเส้นทาง (3 รูป)"
            desc="แนบรูปถนน/เส้นทาง และหมายเหตุ อ้างอิงแผน"
          />

          <CardLink
            to="/ah/docs/upload"
            title="อัปโหลดเอกสาร PDF (สูงสุด 5 ไฟล์)"
            desc="แนบเอกสารที่เกี่ยวข้องกับแผน"
          />

          <CardLink
            to="/ah/catch/confirm"
            title="ยืนยันจำนวนทีมจับสุกร"
            desc="ยืนยันจำนวนบุคลากรที่ไปจับตามแผน"
          />

          <CardLink
            to="/ah/issues"
            title="แจ้งปัญหา (อ้างอิงแผน)"
            desc="ส่งรายงานปัญหา/อุปสรรค และรูป/ไฟล์ประกอบ"
          />

          {/* ที่อยู่รถระหว่างเดินทาง → ลิงก์ไป /ah/status */}
          <CardLink
            to="/ah/status"
            title="ที่อยู่รถระหว่างเดินทาง"
            desc="เช็คตำแหน่งรถขณะมุ่งหน้าโรงงานตามแผน"
          />
        </div>
      </main>
    </div>
  );
}
