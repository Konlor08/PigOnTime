// src/pages/admin/AdminHome.jsx
import { Link, useNavigate } from "react-router-dom";
import logo from "../logo.png";

export default function AdminHome() {
  const nav = useNavigate();

  function handleLogout() {
    try {
      localStorage.removeItem("user");
    } finally {
      nav("/login", { replace: true });
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Pig On Time" className="h-8 w-8" />
          <h1 className="text-2xl font-bold">Pig On Time</h1>
        </div>

        <button
          onClick={handleLogout}
          className="rounded px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800"
        >
          Logout
        </button>
      </div>

      {/* Title */}
      <h2 className="text-xl font-semibold mb-4">Admin — Dashboard</h2>
      <p className="text-gray-600 mb-4">ไปเมนูต่างๆ:</p>

      {/* Dashboard links (เหมือนเดิม) */}
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <Link className="text-blue-600 hover:underline" to="/admin/farms">
            จัดการฟาร์ม
          </Link>
          {"  ·  "}
          <Link className="text-blue-600 hover:underline" to="/admin/farm-upload">
            อัปโหลดฟาร์ม (.xlsx)
          </Link>
        </li>

        <li>
          <Link className="text-blue-600 hover:underline" to="/admin/factories">
            จัดการโรงงาน
          </Link>
          {"  ·  "}
          <Link className="text-blue-600 hover:underline" to="/admin/upload-factory">
            อัปโหลดโรงงาน (.xlsx)
          </Link>
        </li>

        <li>
          <Link className="text-blue-600 hover:underline" to="/admin/upload-truck">
            อัปโหลดรถขนส่ง (.xlsx)
          </Link>
        </li>

        <li>
          <Link className="text-blue-600 hover:underline" to="/admin/link-ah-farms">
            ความสัมพันธ์ AH ↔ ฟาร์ม
          </Link>
        </li>
      </ul>
    </div>
  );
}
