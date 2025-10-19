// src/utils/auth.js
import { supabase } from "../lib/supabaseClient";

/**
* เข้าสู่ระบบด้วย PIN + password
* - ตรวจจากตาราง app_users (ต้องเปิดสิทธิ์ SELECT ให้ anon หรือใช้ RLS ตามที่ตั้งค่า)
* - คืนอ็อบเจ็กต์ user ที่ใช้ใน app
*/
export async function signInWithPassword({ pin, password }) {
if (!pin || !password) {
throw new Error("กรุณากรอก PIN และรหัสผ่าน");
}

// ดึงเฉพาะฟิลด์ที่ระบบใช้งาน
const { data, error } = await supabase
.from("app_users")
.select("id, full_name, role, phone, email, active, pin")
.eq("pin", pin)
.eq("password", password) // ปัจจุบันใช้ plain-text ตามที่ระบุไว้
.single();

if (error) throw new Error(error.message || "เข้าสู่ระบบไม่สำเร็จ");
if (!data) throw new Error("PIN หรือรหัสผ่านไม่ถูกต้อง");
if (data.active === false) throw new Error("บัญชีถูกปิดการใช้งาน");

// เก็บ user ไว้ให้ Router ใช้ตัดสิน role ต่อไป
localStorage.setItem("user", JSON.stringify(data));
return data;
}

export async function signOut() {
try {
// ถ้ามีใช้ Supabase Auth ที่อื่นอยู่ การ signOut นี้ไม่เป็นอันตราย
await supabase.auth.signOut().catch(() => {});
} finally {
localStorage.removeItem("user");
}
}

/**
* ดึงโปรไฟล์จาก app_users ตาม id (ถ้าจำเป็นต้องใช้ที่อื่น)
*/
export async function getProfileByUserId(userId) {
const { data, error } = await supabase
.from("app_users")
.select("id, full_name, role, phone, email, active, pin")
.eq("id", userId)
.single();
if (error) throw new Error(error.message || "ไม่พบผู้ใช้");
return data;
}
