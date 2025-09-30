// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./routes/ProtectedRoute.jsx";

// หน้าทั่วไป
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import HomeSelector from "./pages/HomeSelector.jsx";

// หน้าหลักของแต่ละ role
import AHHome from "./pages/AHHome.jsx";
import ManagerHome from "./pages/ManagerHome.jsx";
import DriverHome from "./pages/DriverHome.jsx";
import FactoryHome from "./pages/FactoryHome.jsx";
import CatchingHome from "./pages/CatchingHome.jsx";
import PlanningHome from "./pages/PlanningHome.jsx";

// Admin (อยู่ใน /pages/admin)
import AdminHome from "./pages/AdminHome.jsx";
import AdminFarms from "./pages/AdminFarms.jsx";
import AdminFarmUpload from "./pages/AdminFarmUpload.jsx";
import AdminFactories from "./pages/AdminFactories.jsx";
import AdminRoles from "./pages/AdminRoles.jsx";

// งานที่เป็นหน้ารวม/อัปโหลด (อยู่ระดับ root ตามที่มีไฟล์)
import UploadFactory from "./pages/UploadFactory.jsx";
import UploadTruck from "./pages/UploadTruck.jsx";

// ความสัมพันธ์
import LinkAHFarms from "./pages/LinkAHFarms.jsx";

export default function App() {
  return (
    <Routes>
      {/* หน้าแรก: ถ้าล็อกอินแล้วให้ HomeSelector เลือกตาม role, ถ้าไม่ล็อกอิน ProtectedRoute จะส่งไป /login */}
      <Route
        path="/"
        element={
          <ProtectedRoute allow="any">
            <HomeSelector />
          </ProtectedRoute>
        }
      />

      {/* Auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/reset" element={<ResetPassword />} />

      {/* ---------- Admin ---------- */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allow={["Admin"]}>
            <AdminHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/farms"
        element={
          <ProtectedRoute allow={["Admin"]}>
            <AdminFarms />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/farm-upload"
        element={
          <ProtectedRoute allow={["Admin"]}>
            <AdminFarmUpload />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/factories"
        element={
          <ProtectedRoute allow={["Admin"]}>
            <AdminFactories />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/roles"
        element={
          <ProtectedRoute allow={["Admin"]}>
            <AdminRoles />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/upload-factory"
        element={
          <ProtectedRoute allow={["Admin"]}>
            <UploadFactory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/upload-truck"
        element={
          <ProtectedRoute allow={["Admin"]}>
            <UploadTruck />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/link-ah-farms"
        element={
          <ProtectedRoute allow={["Admin"]}>
            <LinkAHFarms />
          </ProtectedRoute>
        }
      />

      {/* ---------- AH ---------- */}
      <Route
        path="/ah"
        element={
          <ProtectedRoute allow={["AnimalHusbandry", "Admin"]}>
            <AHHome />
          </ProtectedRoute>
        }
      />

      {/* ---------- Manager ---------- */}
      <Route
        path="/manager"
        element={
          <ProtectedRoute allow={["Manager", "Admin"]}>
            <ManagerHome />
          </ProtectedRoute>
        }
      />

      {/* ---------- Driver ---------- */}
      <Route
        path="/driver"
        element={
          <ProtectedRoute allow={["Driver", "Admin"]}>
            <DriverHome />
          </ProtectedRoute>
        }
      />

      {/* ---------- Factory ---------- */}
      <Route
        path="/factory"
        element={
          <ProtectedRoute allow={["Factory", "Admin"]}>
            <FactoryHome />
          </ProtectedRoute>
        }
      />

      {/* ---------- Catching ---------- */}
      <Route
        path="/catching"
        element={
          <ProtectedRoute allow={["Catching", "Admin"]}>
            <CatchingHome />
          </ProtectedRoute>
        }
      />

      {/* ---------- Planning ---------- */}
      <Route
        path="/planning"
        element={
          <ProtectedRoute allow={["Planning", "Manager", "Admin"]}>
            <PlanningHome />
          </ProtectedRoute>
        }
      />

      {/* Fallback: ใด ๆ ที่ไม่ตรงเส้นทาง -> /login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
