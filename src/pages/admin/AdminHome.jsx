// src/pages/admin/AdminHome.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../../supabaseClient";

export default function AdminHome() {
  const navigate = useNavigate();

  // อ่าน user จาก localStorage (ไว้โชว์มุมขวา ถ้ามี)
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

  // ====== pending farms counter ======
  const [pendingFarms, setPendingFarms] = useState(0);

  useEffect(() => {
    loadPending();
    // fallback: refresh นาน ๆ ครั้งเพื่อกัน count เพี้ยน (เช่นเปิดหลายแท็บ)
    const t = setInterval(loadPending, 60 * 60 * 1000); // 60 นาที
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ฟัง BroadcastChannel → อัปเดต badge แบบเรียลไทม์
  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel("pending-farms");
      bc.onmessage = (ev) => {
        const msg = ev?.data || {};
        if (msg.type === "activated") {
          const delta = Array.isArray(msg.ids) ? msg.ids.length : 1;
          setPendingFarms((n) => Math.max(0, (n || 0) - delta));
        } else if (msg.type === "created") {
          const delta = Array.isArray(msg.ids) ? msg.ids.length : 1;
          setPendingFarms((n) => (n || 0) + delta);
        }
      };
    } catch {
      // ไม่รองรับ BroadcastChannel → ข้าม (ยังมี fallback เป็น interval)
    }
    return () => {
      try {
        bc && bc.close();
      } catch {
        /* noop */
      }
    };
  }, []);

  async function loadPending() {
    try {
      const { count, error } = await supabase
        .from("farms")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      setPendingFarms(count || 0);
    } catch {
      setPendingFarms(0);
    }
  }

  const badgeText = pendingFarms > 99 ? "99+" : pendingFarms;

  // Card + Badge
  const Card = ({ title, desc, to, badgeCount = 0 }) => (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="relative w-full text-left rounded-xl border bg-white/90 shadow-sm hover:shadow-md p-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      aria-label={title}
    >
      {badgeCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow">
          {badgeText}
        </span>
      )}
      <div className="text-xl font-bold text-blue-700">{title}</div>
      <div className="text-gray-600 mt-2">{desc}</div>
    </button>
  );

  const items = [
    { title: "จัดการผู้ใช้", desc: "เพิ่ม / แก้ไข สิทธิ์และสถานะผู้ใช้", to: "/admin/users" },
    { title: "จัดการฟาร์ม", desc: "เพิ่ม แก้ไข สถานะฟาร์ม", to: "/admin/farms" },
    // การ์ดอนุมัติฟาร์มใหม่ (โชว์ badge เฉพาะการ์ดนี้)
    { title: "อนุมัติฟาร์มใหม่ (Pending)", desc: "ตรวจและ Activate ฟาร์มที่รออนุมัติ", to: "/admin/farms/activate" },
    { title: "จัดการโรงงาน", desc: "เพิ่ม แก้ไข สถานะโรงงาน", to: "/admin/factories" },
    { title: "เชื่อม Planner ↔ SITE", desc: "Planner ↔ SITE", to: "/admin/planning-sites" },
    { title: "จัดการรถขนส่ง", desc: "เพิ่มรถใหม่ และสถานะ", to: "/admin/trucks" },
    { title: "จัดการความสัมพันธ์", desc: "ฟาร์ม ↔ นักวิชาการ ↔ โรงงาน ↔ คนขับ/รถ ,User ↔ โรงงาน", to: "/admin/relations" },
    { title: "ติดตามรถทุกคัน", desc: "ติดตามรถทุกคัน (ทุกโรงงาน) แบบเรียลไทม์", to: "/admin/all-trucks" },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Pig On Time" className="h-8 w-8 rounded-sm select-none" draggable={false} />
            <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="hidden sm:block text-sm text-white/90">
                <div className="font-semibold leading-tight">
                  {currentUser.full_name || "ผู้ดูแลระบบ"}
                </div>
                <div className="text-white/70 leading-tight">
                  {(currentUser.role || "admin").toString().toUpperCase()}
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
          {items.map((it) => (
            <Card
              key={it.to}
              {...it}
              badgeCount={it.to === "/admin/farms/activate" ? pendingFarms : 0}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
