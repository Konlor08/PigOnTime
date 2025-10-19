// src/pages/admin/LinkFactories.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../../lib/supabaseClient";

export default function LinkFactories() {
  const [farms, setFarms] = useState([]);
  const [factories, setFactories] = useState([]);
  const [links, setLinks] = useState([]); // [{farm_id, factory_site}]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState(""); // ค้นหา

  const filteredFarms = useMemo(() => {
    if (!q) return farms;
    const s = q.trim().toLowerCase();
    return farms.filter(
      (f) =>
        (f.plant || "").toLowerCase().includes(s) ||
        (f.house || "").toLowerCase().includes(s) ||
        (f.branch || "").toLowerCase().includes(s) ||
        (f.farm_name || "").toLowerCase().includes(s)
    );
  }, [q, farms]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // โหลด farms
      const { data: farmRows, error: farmErr } = await supabase
        .from("farms")
        .select("id, plant, house, branch, farm_name")
        .order("plant", { ascending: true })
        .limit(2000);
      if (farmErr) console.error(farmErr);

      // โหลด factories (ใช้ site เป็น PK แบบที่คุณตั้งไว้)
      const { data: factoryRows, error: facErr } = await supabase
        .from("factories")
        .select("site, branch, name")
        .order("site", { ascending: true })
        .limit(2000);
      if (facErr) console.error(facErr);

      // โหลด links
      const { data: linkRows, error: linkErr } = await supabase
        .from("farm_factory_links")
        .select("farm_id, factory_site");
      if (linkErr) console.error(linkErr);

      setFarms(farmRows || []);
      setFactories(factoryRows || []);
      setLinks(linkRows || []);
      setLoading(false);
    })();
  }, []);

  function getLinkedSite(farmId) {
    const l = links.find((x) => x.farm_id === farmId);
    return l?.factory_site || "";
  }

  async function linkOne(farmId, factorySite) {
    if (!factorySite) return;
    setSaving(true);
    try {
      // ลบลิงก์เก่าของฟาร์มนี้ทิ้งก่อน (ให้มีได้ 1 ต่อ 1 แบบง่าย)
      await supabase.from("farm_factory_links").delete().eq("farm_id", farmId);

      // สร้างลิงก์ใหม่
      const { error } = await supabase
        .from("farm_factory_links")
        .insert([{ farm_id: farmId, factory_site: factorySite }]);
      if (error) throw error;

      setLinks((prev) => [
        ...prev.filter((x) => x.farm_id !== farmId),
        { farm_id: farmId, factory_site: factorySite },
      ]);
    } catch (e) {
      alert(e.message || "ลิงก์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function unlinkOne(farmId) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("farm_factory_links")
        .delete()
        .eq("farm_id", farmId);
      if (error) throw error;

      setLinks((prev) => prev.filter((x) => x.farm_id !== farmId));
    } catch (e) {
      alert(e.message || "ยกเลิกการเชื่อมไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/admin"
          className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-semibold">Admin — เชื่อม ฟาร์ม ↔ โรงงาน</h1>
      </div>

      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา: plant / house / branch / ชื่อฟาร์ม"
          className="w-full max-w-md border rounded px-3 py-2"
        />
      </div>

      {loading ? (
        <p>กำลังโหลด...</p>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Plant</th>
                <th className="p-2 text-left">House</th>
                <th className="p-2 text-left">Branch</th>
                <th className="p-2 text-left">Farm</th>
                <th className="p-2 text-left">โรงงาน (site)</th>
                <th className="p-2 text-left">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredFarms.map((f) => {
                const currentSite = getLinkedSite(f.id);
                return (
                  <tr key={f.id} className="border-t">
                    <td className="p-2">{f.plant}</td>
                    <td className="p-2">{f.house}</td>
                    <td className="p-2">{f.branch}</td>
                    <td className="p-2">{f.farm_name}</td>
                    <td className="p-2">
                      <select
                        className="border rounded px-2 py-1"
                        defaultValue={currentSite}
                        onChange={(e) => linkOne(f.id, e.target.value)}
                        disabled={saving}
                      >
                        <option value="">— เลือกโรงงาน —</option>
                        {factories.map((fa) => (
                          <option key={fa.site} value={fa.site}>
                            {fa.site} — {fa.name || fa.branch || ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      {currentSite ? (
                        <button
                          onClick={() => unlinkOne(f.id)}
                          className="px-3 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
                          disabled={saving}
                        >
                          ยกเลิกเชื่อม
                        </button>
                      ) : (
                        <span className="text-gray-400">ยังไม่เชื่อม</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredFarms.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={6}>
                    ไม่พบข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {saving && <p className="mt-3 text-sm text-gray-500">กำลังบันทึก…</p>}
    </div>
  );
}
