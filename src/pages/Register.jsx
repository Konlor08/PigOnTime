// src/pages/Register.jsx

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import supabase from "../supabaseClient.js";
import Nav from "../Nav.jsx";

const ROLE_TO_PATH = {
  AnimalHusbandry: "/ah",
  Planning: "/planning",
  Manager: "/manager",
  Factory: "/factory",
  Catching: "/catching",
  Driver: "/driver",
};

// --- util เดิม ---
const randomPin = () =>
  String(Math.floor(Math.random() * 10000)).padStart(4, "0");

async function isPinTaken(pin) {
  const { data, error } = await supabase
    .from("app_users")
    .select("id", { count: "exact", head: true })
    .eq("pin", pin);
  if (error) throw error;
  return (data ?? []).length > 0;
}

async function generateUniquePin(maxTry = 20) {
  for (let i = 0; i < maxTry; i++) {
    const pin = randomPin();
    if (!(await isPinTaken(pin))) return pin;
  }
  throw new Error("ไม่สามารถสร้าง PIN ที่ไม่ซ้ำได้ กรุณาลองใหม่");
}

export default function Register() {
  const navigate = useNavigate();

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return;
    try {
      const u = JSON.parse(raw);
      if (u?.role) navigate(ROLE_TO_PATH[u.role] || "/", { replace: true });
    } catch {
      /* ignore */
    }
  }, [navigate]);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("AnimalHusbandry");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [successPin, setSuccessPin] = useState("");

  async function handleGeneratePin() {
    setErr("");
    setSuccessPin("");
    setLoading(true);
    try {
      const newPin = await generateUniquePin();
      setPin(newPin);
    } catch (e) {
      setErr(e.message || "สร้าง PIN ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setSuccessPin("");

    if (!fullName.trim()) return setErr("กรุณากรอกชื่อ-นามสกุล");
    if (!password) return setErr("กรุณากรอกรหัสผ่าน");

    setLoading(true);
    try {
      let finalPin = pin || (await generateUniquePin());

      const payload = {
        pin: finalPin,
        password,
        full_name: fullName,
        phone,
        role,
        active: true,
      };

      const { error } = await supabase
        .from("app_users")
        .insert(payload)
        .single();
      if (error) {
        if ((error.message || "").toLowerCase().includes("duplicate")) {
          const retryPin = await generateUniquePin();
          payload.pin = retryPin;
          const { error: e2 } = await supabase
            .from("app_users")
            .insert(payload)
            .single();
          if (e2) throw e2;
          setSuccessPin(retryPin);
          setPin(retryPin);
        } else {
          throw error;
        }
      } else {
        setSuccessPin(finalPin);
        setPin(finalPin);
      }

      setPassword("");
    } catch (e) {
      setErr(e.message || "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  } // <-- ปิดฟังก์ชัน handleSubmit "ที่นี่" ให้แน่ใจว่ามีปีกกานี้

  // ====== จากนี้จึงเป็น return ของ component ======
  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />

      <main className="mx-auto max-w-screen-md px-3 sm:px-4">
        <div className="mx-auto w-full sm:max-w-md bg-white rounded-xl shadow-sm mt-4 sm:mt-8 p-4 sm:p-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-6">
            Create account
          </h1>

          {err && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {err}
            </div>
          )}

          {successPin && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-800">
              สมัครสมาชิกสำเร็จ! <b>PIN ของคุณคือ {successPin}</b>{" "}
              กรุณาจดหรือบันทึกไว้
            </div>
          )}

          <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
            {/* PIN */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-gray-700">PIN (4 หลัก)</label>
                <button
                  type="button"
                  onClick={handleGeneratePin}
                  className="text-sm text-blue-600 hover:underline disabled:text-gray-400"
                  disabled={loading}
                >
                  {loading ? "กำลังสร้าง…" : "สร้าง PIN ใหม่"}
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="จะถูกสร้างอัตโนมัติ"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                ถ้าไม่ระบุ เราจะสร้างให้โดยอัตโนมัติ
              </p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-gray-700 mb-1">Password</label>
              <div className="flex gap-2">
                <input
                  id="pw"
                  type={showPw ? "text" : "password"}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  className="rounded-lg border px-3 text-gray-700"
                  onClick={() => setShowPw((s) => !s)}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Full name */}
            <div>
              <label className="block text-gray-700 mb-1">Full name</label>
              <input
                type="text"
                placeholder="ชื่อ-นามสกุล"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                placeholder="08xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Role (dropdown คงเดิม) */}
            <div>
              <label className="block text-gray-700 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="AnimalHusbandry">Animal Husbandry</option>
                <option value="Planning">Planning</option>
                <option value="Manager">Manager</option>
                <option value="Factory">Factory</option>
                <option value="Catching">Catching</option>
                <option value="Driver">Driver</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 active:scale-[.99] transition disabled:opacity-60"
            >
              {loading ? "กำลังสมัคร…" : "Register"}
            </button>

            <p className="text-sm text-gray-600">
              มีบัญชีแล้ว?{" "}
              <Link to="/login" className="text-blue-600 hover:underline">
                กลับไปหน้า Login
              </Link>
            </p>
          </form>
        </div>

        <div className="h-6 sm:h-10" />
      </main>
    </div>
  );
} // <-- ปิดฟังก์ชัน Register ที่ท้ายไฟล์
