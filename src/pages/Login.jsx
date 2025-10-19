// src/pages/Login.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import Header from "../components/Header.jsx";

// เส้นทางปลายทางตาม role (ตัวพิมพ์เล็ก)
const ROLE_TO_PATH = {
admin: "/admin",
animalhusbandry: "/ah",
planning: "/planning",
manager: "/manager",
factory: "/factory",
catching: "/catching",
driver: "/driver",
};

export default function Login() {
const navigate = useNavigate();

// form state
const [pin, setPin] = useState("");
const [password, setPassword] = useState("");
const [showPw, setShowPw] = useState(false);

// ui state
const [loading, setLoading] = useState(false);
const [err, setErr] = useState("");

// ถ้ามี session แล้ว ส่งไปตาม role ทันที (ครั้งเดียว)
useEffect(() => {
try {
const u = JSON.parse(localStorage.getItem("user") || "null");
if (u?.role) {
const path = ROLE_TO_PATH[String(u.role).toLowerCase()] || "/admin";
navigate(path, { replace: true });
}
} catch {
/* ignore */
}
}, [navigate]);

async function onSubmit(e) {
e.preventDefault();
setErr("");

const cleanPin = (pin || "").replace(/\D/g, "").slice(0, 4);
const cleanPw = (password || "").trim();

if (!cleanPin || cleanPin.length < 4) {
return setErr("กรุณากรอก PIN 4 หลัก");
}
if (!cleanPw) {
return setErr("กรุณากรอกรหัสผ่าน");
}

setLoading(true);
try {
// หาผู้ใช้ด้วย PIN
const { data: user, error } = await supabase
.from("app_users")
.select("id, role, active, password, full_name")
.eq("pin", cleanPin)
.maybeSingle();

if (error) throw error;
if (!user) {
setErr("ไม่พบผู้ใช้ PIN นี้");
return;
}

// ปิดใช้บัญชี? (null/undefined ให้ถือว่าใช้งานได้)
if (user.active === false) {
setErr("บัญชีถูกปิดการใช้งาน");
return;
}

// เดโม่: เทียบรหัสตรงๆ (ถ้าใช้ hash ให้เปลี่ยนเป็น bcrypt.compare)
if ((user.password || "") !== cleanPw) {
setErr("รหัสผ่านไม่ถูกต้อง");
return;
}

// เก็บ session แบบเรียบง่าย
const roleLower = String(user.role || "").toLowerCase();
localStorage.setItem(
"user",
JSON.stringify({
id: user.id,
pin: cleanPin,
role: roleLower,
full_name: user.full_name || "",
loggedIn: true,
})
);

// ส่งไปยังหน้าตาม role — AnimalHusbandry -> /ah
navigate(ROLE_TO_PATH[roleLower] || "/admin", { replace: true });

// เคลียร์ฟอร์มหลังสำเร็จ (ไม่กระทบธีม)
setPin("");
setPassword("");
setShowPw(false);
} catch (e2) {
setErr(e2.message || "เข้าสู่ระบบไม่สำเร็จ");
} finally {
setLoading(false);
}
}

return (
<div className="min-h-screen bg-gray-50">
<Header />

<main className="mx-auto max-w-screen-md px-3 sm:px-4">
<div className="mx-auto w-full sm:max-w-md bg-white rounded-xl shadow-sm mt-4 sm:mt-8 p-4 sm:p-8">
<h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-6">
Login
</h1>

{err && (
<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
{err}
</div>
)}

<form className="space-y-4 sm:space-y-5" onSubmit={onSubmit}>
{/* PIN */}
<div>
<label className="block text-gray-700 mb-1">PIN (4 หลัก)</label>
<input
type="text"
inputMode="numeric"
pattern="[0-9]*"
placeholder="เช่น 1234"
value={pin}
onChange={(e) =>
setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
}
className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
</div>

{/* Password */}
<div>
<label className="block text-gray-700 mb-1">Password</label>
<div className="flex gap-2">
<input
type={showPw ? "text" : "password"}
value={password}
onChange={(e) => setPassword(e.target.value)}
className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
<button
type="button"
onClick={() => setShowPw((s) => !s)}
className="rounded-lg border px-3 text-gray-700"
>
{showPw ? "Hide" : "Show"}
</button>
</div>
</div>

{/* Submit */}
<button
type="submit"
disabled={loading}
className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
>
{loading ? "กำลังเข้าสู่ระบบ…" : "Login"}
</button>

{/* ลิงก์เสริม */}
<div className="mt-4 flex items-center justify-between text-sm">
<Link to="/register" className="text-indigo-600 hover:underline">
สมัครสมาชิก
</Link>
<Link to="/resetpassword" className="text-indigo-600 hover:underline">
ลืมรหัสผ่าน?
</Link>
</div>
</form>
</div>

<div className="h-6 sm:h-10" />
</main>
</div>
);
}
