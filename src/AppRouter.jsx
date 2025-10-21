// src/AppRouter.jsx
import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

/* ---------- public ---------- */
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

/* ---------- admin (ใช้เท่าที่จำเป็น) ---------- */
import AdminHome from "./pages/admin/AdminHome.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminFarms from "./pages/admin/AdminFarms.jsx";
import AdminFarmUpload from "./pages/admin/AdminFarmUpload.jsx";
import AdminFactories from "./pages/admin/AdminFactories.jsx";
import AdminTrucks from "./pages/admin/AdminTrucks.jsx";
import AdminRelations from "./pages/admin/AdminRelations.jsx";

/* ---------- planning (เท่าที่ใช้อยู่) ---------- */
import PlanningHome from "./pages/PlanningHome.jsx";
import UploadPlanning from "./pages/UploadPlanning.jsx";
import TransportStatus from "./pages/TransportStatus.jsx";

/* ---------- AH (เพิ่มเท่าที่จำเป็น) ---------- */
import AHHome from "./pages/AHHome.jsx";
import AHFarmAdd from "./pages/AHFarmAdd.jsx";
import LinkAHFarms from "./pages/LinkAHFarms.jsx";
import AHLinkFarmFactory from "./pages/AHLinkFarmFactory.jsx";
import AHFarmGPS from "./pages/AHFarmGPS.jsx";
import AHFactoryGPS from "./pages/AHFactoryGPS.jsx";
import AHRoutePhotosLite from "./pages/AHRoutePhotosLite.jsx";
import AHPlanDocsLite from "./pages/AHPlanDocsLite.jsx" ;
import AHCatchTeamLite from "./pages/AHCatchTeamLite.jsx";
import AHReportIssuesLite from "./pages/AHReportIssuesLite.jsx";
import AHPlanStatus from "./pages/AHPlanStatus.jsx";
import FactoryDesk from "./pages/FactoryDesk.jsx";
import DriverDesk from "./pages/DriverDesk.jsx";
import ManagerDesk from "./pages/ManagerDesk.jsx";
import AHDesk from "./pages/AHDesk.jsx";




/* ---------- Catching ---------- */
import CatchingDesk from "./pages/CatchingDesk.jsx";

/* ---------- driver ---------- */



/* ---------- helpers ---------- */
function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function PrivateRoute({ allow = [] }) {
  const u = getUser();
  if (!u) return <Navigate to="/login" replace />;

  const roleLower = String(u.role || "").toLowerCase();
  const allowLower = allow.map((r) => String(r).toLowerCase());
  if (allowLower.length && !allowLower.includes(roleLower)) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

/* ---------- router ---------- */
export default function AppRouter() {
  return (
    <Routes>
      {/* public */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/resetpassword" element={<ResetPassword />} />

      {/* admin */}
      <Route element={<PrivateRoute allow={["admin"]} />}>
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/farms" element={<AdminFarms />} />
        <Route path="/admin/farms/upload" element={<AdminFarmUpload />} />
        <Route path="/admin/factories" element={<AdminFactories />} />
        <Route path="/admin/trucks" element={<AdminTrucks />} />
        <Route path="/admin/relations" element={<AdminRelations />} />
      </Route>

      {/* planning */}
      <Route element={<PrivateRoute allow={["planning"]} />}>
        <Route path="/planning" element={<PlanningHome />} />
        <Route path="/planning/upload" element={<UploadPlanning />} />
        <Route path="/planning/transport" element={<TransportStatus />} />
      </Route>

      {/* animal husbandry (ใหม่) */}
      <Route element={<PrivateRoute allow={["animalhusbandry"]} />}>
        <Route path="/ah" element={<AHHome />} />
        <Route path="/ah/farm/add" element={<AHFarmAdd />} />
        <Route path="/ah/link/farms" element={<LinkAHFarms />} />
        <Route path="/ah/link/farm-factory" element={<AHLinkFarmFactory />} />
        <Route path="/ah/farm/gps" element={<AHFarmGPS />} />
        <Route path="/ah/factory/gps" element={<AHFactoryGPS />} />
        <Route path="/ah/route/photos" element={<AHRoutePhotosLite />} />
        <Route path="/ah/docs/upload" element={<AHPlanDocsLite />} />
        <Route path="/ah/catch/confirm" element={<AHCatchTeamLite />} />
        <Route path="/ah/issues" element={<AHReportIssuesLite />} />
        <Route path="/ah/status" element={<AHDesk />} />
      </Route>

      {/* catching */}
      <Route element={<PrivateRoute allow={["catching"]} />}>
      <Route path="/catching" element={<CatchingDesk />} />
      </Route>

      {/* Driver */}
      <Route element={<PrivateRoute allow={["driver"]}/>}>
        <Route path="/driver" element={<DriverDesk />} />
       </Route>

      {/* Factory */}
      <Route element={<PrivateRoute allow={["factory"]}/>}>
        <Route path="/factory" element={<FactoryDesk />} />
      </Route> 

       {/* Manager */}
      <Route element={<PrivateRoute allow={["manager"]}/>}>
        <Route path="/manager" element={<ManagerDesk />} />
      </Route> 


      {/* fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
