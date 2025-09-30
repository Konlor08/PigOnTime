import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";

// pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import AdminHome from "./pages/AdminHome";
import ManagerHome from "./pages/ManagerHome";
import DriverHome from "./pages/DriverHome";
import FactoryHome from "./pages/FactoryHome";
import AHHome from "./pages/AHHome";

// guard ง่าย ๆ
function ProtectedRoute({ allow, children }) {
  const raw = localStorage.getItem("user");
  const user = raw ? JSON.parse(raw) : null;
  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<MainLayout><Login /></MainLayout>} />
        <Route path="/register" element={<MainLayout><Register /></MainLayout>} />
        <Route path="/reset" element={<MainLayout><ResetPassword /></MainLayout>} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allow={["Admin"]}>
              <MainLayout><AdminHome /></MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager"
          element={
            <ProtectedRoute allow={["Admin","Manager"]}>
              <MainLayout><ManagerHome /></MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver"
          element={
            <ProtectedRoute allow={["Driver","Admin"]}>
              <MainLayout><DriverHome /></MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/factory"
          element={
            <ProtectedRoute allow={["Factory","Admin"]}>
              <MainLayout><FactoryHome /></MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ah"
          element={
            <ProtectedRoute allow={["AnimalHusbandry","Admin"]}>
              <MainLayout><AHHome /></MainLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
