import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function AdminFarms() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadFarms();
  }, []);

  async function loadFarms() {
    setBusy(true);
    setMsg("");
    const { data, error } = await supabase
      .from("farms")
      .select(
        "plant, house, branch, farm_name, subdistrict, district, province, lat, long, status"
      )
      .order("farm_name", { ascending: true });
    if (error) setMsg(error.message);
    setRows(data || []);
    setBusy(false);
  }

  async function handleUploadXlsx(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBusy(true);
      setMsg("");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const records = raw
        .map((r) => ({
          plant: String(r.plant || "").trim(),
          house: String(r.house || "").trim(),
          branch: String(r.branch || "").trim(),
          farm_name: String(r.farm_name || "").trim(),
          sub_district: String(r.subdistrict || "").trim(),
          district: String(r.district || "").trim(),
          province: String(r.province || "").trim(),
          lat: r.lat === "" ? null : Number(r.lat),
          long: r.long === "" ? null : Number(r.long),
          status: /inactive/i.test(String(r.status)) ? "Inactive" : "Active",
        }))
        .filter((x) => x.farm_name);

      if (!records.length) {
        setMsg(
          "ไม่พบข้อมูล (ตรวจหัวตาราง: plant, house, branch, farm_name, subdistrict, district, province, lat, long, status)"
        );
        setBusy(false);
        return;
      }

      const { error } = await supabase
        .from("farms")
        .upsert(records, { onConflict: "plant,house,branch,farm_name" });

      if (error) throw error;

      setMsg(`อัปโหลดสำเร็จ: ${records.length} แถว`);
      await loadFarms();
      e.target.value = "";
    } catch (err) {
      setMsg("อัปโหลดล้มเหลว: " + (err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Admin — จัดการฟาร์ม</h1>

      {/* ปุ่ม Back */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => navigate("/admin")}
          className="px-4 py-2 rounded bg-gray-500 text-white hover:bg-gray-600"
        >
          ← Back to Dashboard
        </button>
      </div>

      <label className="inline-block mb-4">
        <span className="sr-only">Upload Excel</span>
        <input
          type="file"
          accept=".xlsx"
          onChange={handleUploadXlsx}
          disabled={busy}
          className="file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer cursor-pointer"
        />
      </label>

      {msg && <div className="mb-4 text-sm text-red-600">{msg}</div>}

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Plant</th>
              <th className="px-3 py-2 text-left">House</th>
              <th className="px-3 py-2 text-left">Branch</th>
              <th className="px-3 py-2 text-left">Farm</th>
              <th className="px-3 py-2 text-left">Subdistrict</th>
              <th className="px-3 py-2 text-left">District</th>
              <th className="px-3 py-2 text-left">Province</th>
              <th className="px-3 py-2 text-left">Lat</th>
              <th className="px-3 py-2 text-left">Long</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-3 py-2">{r.plant}</td>
                <td className="px-3 py-2">{r.house}</td>
                <td className="px-3 py-2">{r.branch}</td>
                <td className="px-3 py-2">{r.farm_name}</td>
                <td className="px-3 py-2">{r.subdistrict}</td>
                <td className="px-3 py-2">{r.district}</td>
                <td className="px-3 py-2">{r.province}</td>
                <td className="px-3 py-2">{r.lat ?? "-"}</td>
                <td className="px-3 py-2">{r.long ?? "-"}</td>
                <td className="px-3 py-2">
                  {r.status === "Active" ? (
                    <span className="px-2 py-1 rounded bg-green-100 text-green-700">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded bg-gray-200 text-gray-700">
                      Inactive
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-6 text-center text-gray-500"
                >
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
