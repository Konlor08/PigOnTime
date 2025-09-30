import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";

export default function AdminFactories() {
  const [rows, setRows] = useState([]);
  const [notice, setNotice] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setNotice("");
    const { data, error } = await supabase
      .from("factories")
      .select("site, branch, name, subdistrict, district, province, lat, long, status")
      .order("branch", { ascending: true });
    if (error) setNotice(error.message);
    else setRows(data || []);
  }

  async function handleUpload(e) {
    setNotice("");
    const file = e.target.files?.[0];
    if (!file) return;

    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

    // map header -> db columns (ต้องสะกดตามนี้ในไฟล์: site, branch, name, subdistrict, district, province, lat, long, status)
    const records = json.map(r => ({
      site: String(r.site || "").trim(),
      branch: String(r.branch || "").trim(),
      name: String(r.name || "").trim(),
      subdistrict: String(r.subdistrict || "").trim(),
      district: String(r.district || "").trim(),
      province: String(r.province || "").trim(),
      lat: r.lat === "" ? null : Number(r.lat),
      long: r.long === "" ? null : Number(r.long),
      status: (r.status || "Active").trim(),
    })).filter(r => r.site && r.branch && r.name); // ต้องมี key หลัก

    if (!records.length) { setNotice("ไม่พบข้อมูลที่ครบคีย์หลัก (site, branch, name)"); return; }

    const { error } = await supabase
      .from("factories")
      .upsert(records, { onConflict: "site" }); // ปรับตาม unique key ของคุณ

    if (error) setNotice("อัปโหลดล้มเหลว: " + error.message);
    else { setNotice(`อัปโหลดสำเร็จ: อัปเดต/เพิ่ม ${records.length} แถว`); load(); }
    e.target.value = "";
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Admin — จัดการโรงงาน</h1>

      {/* ปุ่มกลับไป Dashboard */}
      <div className="mb-4">
        <Link
          to="/admin"
          className="inline-flex items-center rounded px-4 py-2 border bg-gray-100 hover:bg-gray-200"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* อัปโหลดไฟล์ */}
      <div className="mb-4">
        <label className="inline-block">
          <span className="sr-only">Choose File</span>
          <input type="file" accept=".xlsx,.xls" onChange={handleUpload}
                 className="file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700" />
        </label>
      </div>

      {notice && (
        <div className="mb-4 text-sm text-red-600">{notice}</div>
      )}

      {/* ตาราง */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Site</th>
              <th className="px-3 py-2 text-left">Branch</th>
              <th className="px-3 py-2 text-left">Name</th>
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
                <td className="px-3 py-2">{r.site}</td>
                <td className="px-3 py-2">{r.branch}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.subdistrict}</td>
                <td className="px-3 py-2">{r.district}</td>
                <td className="px-3 py-2">{r.province}</td>
                <td className="px-3 py-2">{r.lat}</td>
                <td className="px-3 py-2">{r.long}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${r.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>
                    {r.status || "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={9}>ไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
