import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../lib/supabaseClient"; // ต้องเป็น default export: export default supabase

export default function LinkAHFarms() {
  const [ahs, setAhs] = useState([]);
  const [ahId, setAhId] = useState("");
  const [farms, setFarms] = useState([]);
  const [links, setLinks] = useState([]); // ของ AH ที่เลือก
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // โหลดรายชื่อ AH (role = AnimalHusbandry)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("app_users")
        .select("id, full_name, phone")
        .eq("role", "AnimalHusbandry")
        .eq("active", true)
        .order("full_name", { ascending: true });

      if (error) {
        console.warn(error);
        setMsg("โหลดรายชื่อ AH ไม่สำเร็จ");
        return;
      }
      setAhs(data || []);
      // เลือกคนแรกให้เลย ถ้ามี
      if ((data || []).length && !ahId) setAhId(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // โหลดฟาร์มทั้งหมด
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("farms")
        .select(
          "plant, house, branch, farm_name, sub_district, district, province"
        )
        .order("branch", { ascending: true })
        .order("farm_name", { ascending: true });

      if (error) {
        console.warn(error);
        setMsg("โหลดฟาร์มไม่สำเร็จ");
        return;
      }
      setFarms(data || []);
    })();
  }, []);

  // โหลดลิงก์ของ AH คนที่เลือก
  useEffect(() => {
    if (!ahId) return;
    (async () => {
      const { data, error } = await supabase
        .from("ah_farm_links")
        .select("id, plant, house, branch, farm_name, active")
        .eq("profile_id", ahId);

      if (error) {
        console.warn(error);
        setMsg("โหลดลิงก์ฟาร์มของ AH ไม่สำเร็จ");
        return;
      }
      setLinks(data || []);
    })();
  }, [ahId]);

  // map ไว้เช็กเร็ว ๆ ว่าฟาร์มไหนลิงก์แล้ว
  const linkedKey = useMemo(() => {
    const m = new Map();
    for (const r of links) {
      m.set(`${r.plant}|${r.house}|${r.branch}|${r.farm_name}`, r);
    }
    return m;
  }, [links]);

  const filteredFarms = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return farms;
    return farms.filter((f) =>
      `${f.branch} ${f.farm_name} ${f.house} ${f.plant} ${f.sub_district ?? ""} ${f.district ?? ""} ${f.province ?? ""}`
        .toLowerCase()
        .includes(k)
    );
  }, [q, farms]);

  async function linkFarm(f) {
    if (!ahId) return alert("กรุณาเลือก AH");
    setBusy(true);
    setMsg("");
    const payload = {
      profile_id: ahId,
      plant: f.plant,
      house: f.house,
      branch: f.branch,
      farm_name: f.farm_name,
      active: true,
    };
    const { error } = await supabase.from("ah_farm_links").upsert(payload, {
      onConflict: "profile_id,plant,house,branch,farm_name",
    });
    if (error) {
      console.warn(error);
      alert("ลิงก์ไม่สำเร็จ: " + error.message);
    } else {
      // refresh
      const { data } = await supabase
        .from("ah_farm_links")
        .select("id, plant, house, branch, farm_name, active")
        .eq("profile_id", ahId);
      setLinks(data || []);
    }
    setBusy(false);
  }

  async function toggleActive(rec) {
    setBusy(true);
    const { error } = await supabase
      .from("ah_farm_links")
      .update({ active: !rec.active })
      .eq("id", rec.id);
    if (error) {
      console.warn(error);
      alert("สลับสถานะไม่สำเร็จ: " + error.message);
    } else {
      setLinks((old) =>
        old.map((x) => (x.id === rec.id ? { ...x, active: !x.active } : x))
      );
    }
    setBusy(false);
  }

  async function unlink(rec) {
    if (!confirm("ลบความเชื่อมโยงกับฟาร์มนี้?")) return;
    setBusy(true);
    const { error } = await supabase.from("ah_farm_links").delete().eq("id", rec.id);
    if (error) {
      console.warn(error);
      alert("ลบลิงก์ไม่สำเร็จ: " + error.message);
    } else {
      setLinks((old) => old.filter((x) => x.id !== rec.id));
    }
    setBusy(false);
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin — เชื่อม AH กับฟาร์ม</h1>
        <Link to="/admin" className="text-blue-600 hover:underline">
          ◀ กลับ Dashboard
        </Link>
      </div>

      {/* เลือก AH */}
      <div className="mb-4">
        <label className="block text-sm mb-1">เลือก Animal Husbandry</label>
        <select
          className="border rounded px-3 py-2 w-full sm:w-96"
          value={ahId}
          onChange={(e) => setAhId(e.target.value)}
        >
          {ahs.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name} {u.phone ? `(${u.phone})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* ค้นหา */}
      <div className="mb-4">
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="ค้นหา (branch / farm / house / plant / ตำบล / อำเภอ / จังหวัด)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {msg && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ตารางฟาร์มทั้งหมด */}
        <section>
          <h2 className="font-semibold mb-2">ฟาร์มทั้งหมด</h2>
          <div className="border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Branch</th>
                  <th className="p-2 text-left">Farm</th>
                  <th className="p-2 text-left">House</th>
                  <th className="p-2 text-left">Plant</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredFarms.map((f) => {
                  const key = `${f.plant}|${f.house}|${f.branch}|${f.farm_name}`;
                  const lk = linkedKey.get(key);
                  return (
                    <tr key={key} className="border-t">
                      <td className="p-2">{f.branch}</td>
                      <td className="p-2">{f.farm_name}</td>
                      <td className="p-2">{f.house}</td>
                      <td className="p-2">{f.plant}</td>
                      <td className="p-2 text-right">
                        {lk ? (
                          <span className="text-gray-500">เชื่อมแล้ว</span>
                        ) : (
                          <button
                            disabled={busy || !ahId}
                            onClick={() => linkFarm(f)}
                            className="px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                          >
                            Link
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!filteredFarms.length && (
                  <tr>
                    <td className="p-3 text-center text-gray-500" colSpan={5}>
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ตารางฟาร์มที่เชื่อมกับ AH */}
        <section>
          <h2 className="font-semibold mb-2">ฟาร์มที่เชื่อมกับ AH</h2>
          <div className="border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Branch</th>
                  <th className="p-2 text-left">Farm</th>
                  <th className="p-2 text-left">House</th>
                  <th className="p-2 text-left">Plant</th>
                  <th className="p-2 text-left">สถานะ</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {links.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.branch}</td>
                    <td className="p-2">{r.farm_name}</td>
                    <td className="p-2">{r.house}</td>
                    <td className="p-2">{r.plant}</td>
                    <td className="p-2">
                      <button
                        disabled={busy}
                        onClick={() => toggleActive(r)}
                        className={`px-2 py-1 rounded ${
                          r.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {r.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="p-2 text-right">
                      <button
                        disabled={busy}
                        onClick={() => unlink(r)}
                        className="px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {!links.length && (
                  <tr>
                    <td className="p-3 text-center text-gray-500" colSpan={6}>
                      ยังไม่มีการเชื่อม
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
