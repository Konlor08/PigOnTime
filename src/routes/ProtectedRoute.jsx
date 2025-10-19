// src/routes/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
const location = useLocation();
const raw = localStorage.getItem("user");
const authed = !!raw;

if (!authed) {
// ยังไม่ได้ล็อกอิน -> ส่งไป /login และจำ path เดิมไว้
return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
return children;
}