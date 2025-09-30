import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const roleToPath = {
  Admin: "/admin",
  Manager: "/manager",
  Driver: "/driver",
  Factory: "/factory",
  AnimalHusbandry: "/ah",
  Catching: "/catching",
  Planning: "/planning",
};

export default function Login() {
  const nav = useNavigate();
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setMsg("");
    if (pin.trim().length !== 4) { setMsg("กรุณาใส่ PIN 4 หลัก"); return; }
    if (!password) { setMsg("กรุณาใส่รหัสผ่าน"); return; }

    setBusy(true);
    // เรียกฟังก์ชันใน DB ให้ตรวจ PIN+Password
    const { data, error } = await supabase
      .rpc("login_with_pin", { p_pin: pin.trim(), p_password: password });

    setBusy(false);

    if (error) { setMsg(error.message); return; }
    if (!data || data.length === 0) { setMsg("PIN หรือรหัสผ่านไม่ถูกต้อง หรือผู้ใช้ไม่ Active"); return; }

    const u = data[0]; // { id, full_name, role }
    const session = { id: u.id, name: u.full_name, role: u.role, loggedIn: true };
    localStorage.setItem("user", JSON.stringify(session));

    const path = roleToPath[u.role] ?? "/login";
    nav(path, { replace: true });
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <div className="flex items-center justify-center mb-4">
        <img src="/logo.png" alt="Pig On Time" className="h-10 w-auto" />
      </div>

      <form onSubmit={handleLogin} className="bg-white shadow rounded p-6 space-y-4">
        {msg && <div className="text-red-600 text-sm">{msg}</div>}

        <div>
          <label className="block text-sm mb-1">PIN (4 หลัก)</label>
          <input
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="w-full border rounded px-3 py-2"
            placeholder="เช่น 1234"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">รหัสผ่าน</label>
          <div className="flex">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-l px-3 py-2"
              placeholder="••••••"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="px-3 border rounded-r"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <button
          disabled={busy}
          className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60"
        >
          {busy ? "กำลังเข้าสู่ระบบ..." : "Login"}
        </button>

        <div className="flex justify-between text-sm pt-1">
          <Link to="/register" className="text-blue-600 hover:underline">สมัครสมาชิก</Link>
          <Link to="/reset" className="text-blue-600 hover:underline">รีเซ็ตรหัสผ่าน</Link>
        </div>
      </form>
    </main>
  );
}
