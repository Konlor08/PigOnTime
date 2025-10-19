// src/pages/AHFarmAdd.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";

export default function AHFarmAdd() {
  const navigate = useNavigate();

  // ----- message / loading -----
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // ----- form -----
  const empty = {
    farm_name: "",
    plant: "",
    house: "",
    branch: "",
    subdistrict: "",
    district: "",
    province: "",
    lat: "",
    long: "",
    status: "active",
  };
  const [form, setForm] = useState(empty);

  // ----- success message auto-hide 3s -----
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 3000); // ซ่อนเฉพาะข้อความสำเร็จ
    return () => clearTimeout(t);
  }, [msg]);

  // ----- handlers -----
  const onChange = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    // ไม่ล้าง error อัตโนมัติ ให้ค้างจนกว่าจะกดบันทึกใหม่ตามที่ขอ
  };

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(""); // เริ่มรอบใหม่ ล้าง success เดิม
    setErr(""); // กดบันทึกใหม่ จึงล้าง error เดิม
    if (!form.farm_name.trim()) {
      setErr("กรุณากรอกชื่อฟาร์ม");
      return;
    }

    // แปลง lat/long
    const lat =
      form.lat === "" ? null : Number.isFinite(+form.lat) ? +form.lat : null;
    const long =
      form.long === "" ? null : Number.isFinite(+form.long) ? +form.long : null;

    setLoading(true);
    try {
      const { error } = await supabase.from("farms").insert([
        {
          farm_name: form.farm_name.trim(),
          plant: form.plant || null,
          house: form.house || null,
          branch: form.branch || null,
          subdistrict: form.subdistrict || null,
          district: form.district || null,
          province: form.province || null,
          lat,
          long,
          status: form.status || "active",
        },
      ]);
      if (error) throw error;

      setForm(empty); // ล้างฟอร์มให้กรอกตัวถัดไปได้เลย
      setMsg("บันทึกสำเร็จ"); // จะแสดง 3 วินาที แล้วหาย
    } catch (e2) {
      setErr(e2.message || "บันทึกไม่สำเร็จ"); // error จะค้างไว้ตามต้องการ
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-emerald-50">
      {/* Header */}
      <header className="bg-emerald-600 text-white">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">เพิ่มฟาร์ม (ครั้งละหนึ่ง)</h1>
          <button
            type="button"
            onClick={() => navigate("/ah", { replace: true })}
            className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20"
          >
            กลับหน้า Aniaml husbandry
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Alerts */}
        {msg && (
          <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-700">
            {msg}
          </div>
        )}
        {err && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">
            {err}
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {/* ชื่อฟาร์ม */}
          <div className="sm:col-span-2">
            <label className="block text-gray-700 mb-1">
              ชื่อฟาร์ม <span className="text-red-600">*</span>
            </label>
            <input
              value={form.farm_name}
              onChange={onChange("farm_name")}
              required
              className="w-full rounded-md border bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Plant / Branch / House */}
          <div>
            <label className="block text-gray-700 mb-1">Plant</label>
            <input
              value={form.plant}
              onChange={onChange("plant")}
              className="w-full rounded-md border bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Branch</label>
            <input
              value={form.branch}
              onChange={onChange("branch")}
              className="w-full rounded-md border bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">House</label>
            <input
              value={form.house}
              onChange={onChange("house")}
              className="w-full rounded-md border bg-white px-3 py-2"
            />
          </div>

          {/* Subdistrict / District / Province */}
          <div>
            <label className="block text-gray-700 mb-1">
              ตำบล (Subdistrict)
            </label>
            <input
              value={form.subdistrict}
              onChange={onChange("subdistrict")}
              className="w-full rounded-md border bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">อำเภอ (District)</label>
            <input
              value={form.district}
              onChange={onChange("district")}
              className="w-full rounded-md border bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">
              จังหวัด (Province)
            </label>
            <input
              value={form.province}
              onChange={onChange("province")}
              className="w-full rounded-md border bg-white px-3 py-2"
            />
          </div>

          {/* Lat / Long */}
          <div>
            <label className="block text-gray-700 mb-1">Lat</label>
            <input
              value={form.lat}
              onChange={onChange("lat")}
              inputMode="decimal"
              className="w-full rounded-md border bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Long</label>
            <input
              value={form.long}
              onChange={onChange("long")}
              inputMode="decimal"
              className="w-full rounded-md border bg-white px-3 py-2"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-gray-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={onChange("status")}
              className="w-full rounded-md border bg-white px-3 py-2"
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>

          {/* Actions */}
          <div className="sm:col-span-2 mt-2 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-emerald-600 px-5 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "กำลังบันทึก…" : "บันทึก"}
            </button>
            <button
              type="button"
              onClick={() => {
                setErr("");
                setMsg("");
                setForm(empty);
              }}
              className="rounded-md border px-5 py-2 hover:bg-gray-50"
            >
              ล้างฟอร์ม
            </button>
            <button
              type="button"
              onClick={() => navigate("/ah", { replace: true })}
              className="rounded-md border px-5 py-2 hover:bg-gray-50"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
