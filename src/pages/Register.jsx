import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import supabaseDefault, {
  supabase as supabaseNamed,
} from "../lib/supabaseClient";
const sb = supabaseNamed ?? supabaseDefault;

const ROLES = ["Catching","Driver","Factory","Manager","Planning","AnimalHusbandry"];

async function generateUniquePin() {
  // สุ่ม PIN 4 หลัก ไม่ซ้ำใน app_users
  for (let i = 0; i < 20; i++) {
    const pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const { data } = await sb
      .from("app_users")
      .select("id")
      .eq("pin", pin)
      .maybeSingle();
    if (!data) return pin;
  }
  throw new Error("ไม่สามารถสร้าง PIN ได้ กรุณาลองใหม่");
}

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("AnimalHusbandry");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [createdPin, setCreatedPin] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    if (!email) return setMsg("กรุณาใส่ Email");
    if (!password || password.length < 6)
      return setMsg("รหัสผ่านอย่างน้อย 6 ตัวอักษร");
    if (!fullName) return setMsg("กรุณาใส่ชื่อ-นามสกุล");
    if (!phone) return setMsg("กรุณาใส่เบอร์โทร");
    if (!ROLES.includes(role)) return setMsg("Role ไม่ถูกต้อง");

    setBusy(true);
    try {
      const pin = await generateUniquePin();
      const { error } = await sb.from("app_users").insert([
        {
          email,
          password, // ถ้าต้องการเข้ารหัส ให้เปลี่ยนเป็น hash ก่อน insert
          full_name: fullName,
          phone,
          role,
          pin,
          active: true,
        },
      ]);
      if (error) throw error;
      setCreatedPin(pin);
      // แจ้ง PIN แล้วพาไปหน้า login
      alert(`สมัครสำเร็จ! PIN ของคุณคือ ${pin}`);
      nav("/login", { replace: true });
    } catch (err) {
      console.error(err);
      setMsg(err.message || "สมัครไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <img src="/logo.png" alt="Pig On Time" style={{ height: 40 }} />
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 20,
          background: "#fff",
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>
          Create account
        </h1>

        {msg && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: 10,
              borderRadius: 6,
              marginBottom: 12,
            }}
          >
            {msg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@example.com"
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: 10,
              marginBottom: 12,
            }}
          />

          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Password
          </label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="อย่างน้อย 6 ตัวอักษร"
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: 10,
              marginBottom: 12,
            }}
          />

          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Full name
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="ชื่อ-นามสกุล"
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: 10,
              marginBottom: 12,
            }}
          />

          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Phone
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xxxxxxxx"
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: 10,
              marginBottom: 12,
            }}
          />

          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: 10,
              marginBottom: 16,
            }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            disabled={busy}
            type="submit"
            style={{
              width: "100%",
              background: busy ? "#60a5fa" : "#2563eb",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              fontWeight: 700,
            }}
          >
            {busy ? "กำลังสมัคร..." : "Register"}
          </button>
        </form>

        <div style={{ marginTop: 12, fontSize: 14, textAlign: "center" }}>
          มีบัญชีอยู่แล้ว? <Link to="/login">เข้าสู่ระบบ</Link>
        </div>

        {createdPin && (
          <p style={{ marginTop: 10, color: "#065f46" }}>
            หมายเหตุ: PIN ของคุณคือ <b>{createdPin}</b> (จะแจ้งผ่าน alert
            แล้วพาไปหน้า Login)
          </p>
        )}
      </div>
    </main>
  );
}
