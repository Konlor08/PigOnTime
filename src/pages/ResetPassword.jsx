import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import supabaseDefault, { supabase as supabaseNamed } from "../lib/supabaseClient";
const sb = supabaseNamed ?? supabaseDefault;

export default function ResetPassword() {
  const nav = useNavigate();
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    if (!/^\d{4}$/.test(pin)) return setMsg("กรุณาใส่ PIN 4 หลัก");
    if (!password || password.length < 6) return setMsg("รหัสผ่านอย่างน้อย 6 ตัวอักษร");

    setBusy(true);
    try {
      // ตรวจว่ามีผู้ใช้จริง
      const { data: user, error: selErr } = await sb
        .from("app_users")
        .select("id")
        .eq("pin", pin)
        .maybeSingle();
      if (selErr) throw selErr;
      if (!user) {
        setMsg("ไม่พบผู้ใช้ที่มี PIN นี้");
        return;
      }

      // อัปเดตรหัสผ่าน
      const { error: updErr } = await sb
        .from("app_users")
        .update({ password })
        .eq("id", user.id);
      if (updErr) throw updErr;

      alert("ตั้งรหัสผ่านใหม่เรียบร้อย");
      nav("/login", { replace: true });
    } catch (err) {
      console.error(err);
      setMsg(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <img src="/logo.png" alt="Pig On Time" style={{ height: 40 }} />
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, background: "#fff" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>ตั้งรหัสผ่านใหม่</h1>

        {msg && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 6, marginBottom: 12 }}>
            {msg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>PIN (4 หลัก)</label>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            pattern="\d{4}"
            placeholder="เช่น 1234"
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: 10, marginBottom: 12 }}
          />

          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>รหัสผ่านใหม่</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="อย่างน้อย 6 ตัวอักษร"
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: 10, marginBottom: 16 }}
          />

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
            {busy ? "กำลังบันทึก..." : "Reset"}
          </button>
        </form>

        <div style={{ marginTop: 12, fontSize: 14, textAlign: "center" }}>
          <Link to="/login">กลับไปหน้าเข้าสู่ระบบ</Link>
        </div>
      </div>
    </main>
  );
}
