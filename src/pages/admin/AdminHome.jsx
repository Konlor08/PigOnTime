// src/pages/admin/AdminHome.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

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

// การ์ดแบบปุ่ม (ทั้งก้อนกดได้)
const Card = ({ title, desc, to }) => (
<button
type="button"
onClick={() => navigate(to)}
className="w-full text-left rounded-xl border bg-white/90 shadow-sm hover:shadow-md p-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
aria-label={title}
>
<div className="text-xl font-bold text-blue-700">{title}</div>
<div className="text-gray-600 mt-2">{desc}</div>
</button>
);

// ✅ ลิงก์ที่จำเป็นจริง ๆ ก่อน (เพิ่มภายหลังได้)
const items = [
{ title: "จัดการผู้ใช้", desc: "เพิ่ม / แก้ไข สิทธิ์และสถานะผู้ใช้", to: "/admin/users" },
{ title: "จัดการฟาร์ม", desc: "เพิ่ม แก้ไข สถานะฟาร์ม", to: "/admin/farms" },
{ title: "จัดการโรงงาน", desc: "เพิ่ม แก้ไข สถานะโรงงาน", to: "/admin/factories" },
{ title: "เชื่อม Planner ↔ SITE", desc: "Planner ↔ SITE", to: "/admin/planning-sites" },
{ title: "จัดการรถขนส่ง", desc: "เพิ่มรถใหม่ และสถานะ", to: "/admin/trucks" },
{ title: "จัดการความสัมพันธ์", desc: "ฟาร์ม ↔ นักวิชาการ ↔ โรงงาน ↔ คนขับ/รถ", to: "/admin/relations" },
];

return (
<div className="min-h-screen bg-gray-100">
{/* Header */}
<header className="bg-blue-600 text-white">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<div className="flex items-center gap-3">
{/* ใช้ไฟล์ใน public แบบเดิม ป้องกันปัญหา path */}
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
className="rounded-md bg-white/10 px-4 py-2 hover:bg白/20 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
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
<Card key={it.to} {...it} />
))}
</div>
</main>
</div>
);
}
