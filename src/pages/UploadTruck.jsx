import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function UploadTruck() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("กรุณาเลือกไฟล์ Excel ก่อน");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      try {
        const { error } = await supabase.from("trucks").upsert(worksheet, {
          onConflict: "truck_id",
        });

        if (error) throw error;
        setMessage("อัพโหลดข้อมูลรถขนส่งสำเร็จ");
      } catch (err) {
        setMessage("เกิดข้อผิดพลาด: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">อัพโหลดข้อมูลรถขนส่ง (Excel)</h1>

      <input
        type="file"
        accept=".xlsx"
        onChange={handleFileChange}
        className="mb-4"
      />

      <button
        onClick={handleUpload}
        className="bg-green-600 text-white px-4 py-2 rounded mb-2"
      >
        อัพโหลด
      </button>

      {message && <p className="mt-2">{message}</p>}

{/* ปุ่ม Back */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => navigate("/admin")}
          className="px-4 py-2 rounded bg-gray-500 text-white hover:bg-gray-600"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* ✅ ปุ่ม Logout */}
      <button
        onClick={() => navigate("/login")}
        className="bg-red-600 text-white px-4 py-2 rounded mt-2"
      >
        ออกจากระบบ
      </button>
    </div>
  );
}
