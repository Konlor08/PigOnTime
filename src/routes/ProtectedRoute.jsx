// src/routes/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ allow = "any", children }) {
  // อ่าน user จาก localStorage แบบปลอดภัย
  let user = null;
  try {
    const raw = localStorage.getItem("user");
    user = raw ? JSON.parse(raw) : null;
  } catch {
    user = null;
  }

  // ถ้าไม่มี user หรือยังไม่ได้ login => กลับไปหน้า login
  if (!user || user.loggedIn !== true) {
    return <Navigate to="/login" replace />;
  }

  // อนุญาตทุก role
  if (allow === "any") return children;

  // บังคับให้ allow เป็น array เสมอ
  const allowList = Array.isArray(allow) ? allow : [allow];

  // ไม่อยู่ในสิทธิ์ก็ให้ไป login ใหม่ (กัน role ผิด)
  if (!user.role || !allowList.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
