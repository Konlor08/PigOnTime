import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const roleToPath = {
  Admin: "/admin",
  Manager: "/manager",
  Driver: "/driver",
  Factory: "/factory",
  AnimalHusbandry: "/ah",
  Catching: "/catching",
  Planning: "/planning",
};

export default function HomeSelector() {
  const nav = useNavigate();

  useEffect(() => {
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      user = null;           // สำคัญ: กัน no-empty + ปลอดภัย
    }

    if (!user || user.loggedIn !== true) {
      nav("/login", { replace: true });
      return;
    }

    const path = roleToPath[user.role] || "/login";
    nav(path, { replace: true });
  }, [nav]);

  return null; // เด้งอย่างเดียว
}
