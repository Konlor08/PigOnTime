// src/pages/AHMyFarms.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function getUser() {
  try {
    const s = localStorage.getItem("user");
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export default function AHMyFarms() {
  const user = getUser();
  const [links, setLinks] = useState([]);
  const [farms, setFarms] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      // ลิงก์ของ AH คนนี้
      const { data: linkRows } = await supabase
        .from("ah_farm_links")
        .select("plant, house, branch, farm_name, active")
        .eq("profile_id", user.id)
        .eq("active", true);
      setLinks(linkRows || []);

      // ดึงฟาร์มทั้งหมดครั้งเดียว (ข้อมูลไม่เยอะ) แล้วจับคู่ในแอป
      const { data: farmRows } = await supabase
        .from("farms")
        .select("plant, house, branch, farm_name, status, sub_district, district, province, lat, lng");
      setFarms(farmRows || []);
    })();
  }, [user?.id]);

  // จับคู่ฟาร์มตามลิงก์
  const myFarms = useMemo(() => {
    if (!links.length || !farms.length) return [];
    const map = new Map(
      farms.map((f) => [
        `${f.plant}::${f.house}::${f.branch}::${f.farm_name}`,
        f,
      ])
    );
    return links
      .map((l) => map.get(`${l.plant}::${l.house}::${l.branch}::${l.farm_name}`))
      .filter(Boolean);
  }, [links, farms]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return myFarms;
    return myFarms.filter((f) =>
      [
        f.branch,
        f.farm_name,
        f.house,
        f.plant,
        f.sub_district,
        f.district,
        f.province,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(k))
    );
  }, [myFarms, q]);

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">ฟาร์มที่รับผิดชอบ</h1>

      <div className="card p-4 mb-4">
        <input
          className="ipt"
          placeholder="ค้นหา (branch / farm / house / plant / ตำบล / อำเภอ / จังหวัด)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <p className="muted mt-2">
          ทั้งหมด {myFarms.length} ฟาร์ม • กำลังแสดง {shown.length} รายการ
        </p>
      </div>

      <div className="overflow-auto border rounded bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">Branch</th>
              <th className="text-left px-3 py-2">Farm</th>
              <th className="text-left px-3 py-2">House</th>
              <th className="text-left px-3 py-2">Plant</th>
              <th className="text-left px-3 py-2">ตำบล</th>
              <th className="text-left px-3 py-2">อำเภอ</th>
              <th className="text-left px-3 py-2">จังหวัด</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.length ? (
              shown.map((f, i) => (
                <tr key={`${f.plant}-${f.house}-${f.branch}-${f.farm_name}-${i}`} className="border-b">
                  <td className="px-3 py-2">{f.branch}</td>
                  <td className="px-3 py-2">{f.farm_name}</td>
                  <td className="px-3 py-2">{f.house}</td>
                  <td className="px-3 py-2">{f.plant}</td>
                  <td className="px-3 py-2">{f.sub_district || "-"}</td>
                  <td className="px-3 py-2">{f.district || "-"}</td>
                  <td className="px-3 py-2">{f.province || "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      (f.status || "").toLowerCase() === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 text-gray-700"
                    }`}>
                      {f.status || "Inactive"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={8}>ยังไม่มีฟาร์มที่เชื่อมโยง</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
