// src/pages/admin/AdminActivateFarms.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import supabase from "../../supabaseClient";

export default function AdminActivateFarms() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2500);
    return () => clearTimeout(t);
  }, [msg]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data, error } = await supabase
        .from("farms")
        .select(
          "id, plant, branch, house, farm_name, subdistrict, district, province, status, created_at"
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows(data || []);
      setSelected(new Set());
    } catch (e) {
      setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const t =
        [
          r.plant,
          r.branch,
          r.house,
          r.farm_name,
          r.subdistrict,
          r.district,
          r.province,
        ]
          .map((x) => String(x ?? "").toLowerCase())
          .join(" ");
      return t.includes(s);
    });
  }, [q, rows]);

  function toggleAll(checked) {
    if (!checked) return setSelected(new Set());
    setSelected(new Set(filtered.map((r) => r.id)));
  }

  function toggleOne(id, checked) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function approve(ids) {
    if (!ids.length) return;
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const { data, error } = await supabase
        .from("farms")
        .update({
          status: "active",
          active: true,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids)
        .eq("status", "pending")
        .select("id");

      if (error) throw error;

      // 🔔 แจ้ง AdminHome ให้ลด badge ทันที
      try {
        const bc = new BroadcastChannel("pending-farms");
        bc.postMessage({
          type: "activated",
          ids: (data || []).map((r) => r.id),
        });
        bc.close();
      } catch {
        /* no-op: ไม่รองรับ BroadcastChannel */
      }

      setMsg(`อนุมัติแล้ว ${data?.length ?? 0} ฟาร์ม`);
      await load();
    } catch (e) {
      setErr(e.message || "อนุมัติไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Pig On Time"
              className="h-8 w-8 rounded-sm select-none"
              draggable={false}
            />
            <h1 className="text-2xl font-semibold">อนุมัติฟาร์มใหม่ (Pending)</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20"
            >
              ← กลับ Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 mt-6 pb-10">
        {msg && (
          <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
            {msg}
          </div>
        )}
        {err && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหา plant / branch / house / ฟาร์ม / ตำบล / อำเภอ / จังหวัด"
              className="w-full sm:w-96 border rounded px-3 py-2"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => approve(Array.from(selected))}
                disabled={loading || selected.size === 0}
                className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "กำลังอนุมัติ..." : `อนุมัติที่เลือก (${selected.size})`}
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="px-3 py-2 rounded-md border hover:bg-gray-50"
              >
                รีเฟรช
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm whitespace-nowrap">
              <thead className="bg-blue-50 border-b">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      onChange={(e) => toggleAll(e.target.checked)}
                      checked={
                        filtered.length > 0 &&
                        selected.size === filtered.length
                      }
                      aria-label="เลือกทั้งหมด"
                    />
                  </th>
                  <th className="px-3 py-2 text-left">Plant</th>
                  <th className="px-3 py-2 text-left">Branch</th>
                  <th className="px-3 py-2 text-left">House</th>
                  <th className="px-3 py-2 text-left">ฟาร์ม (ชื่อ)</th>
                  <th className="px-3 py-2 text-left">ตำบล</th>
                  <th className="px-3 py-2 text-left">อำเภอ</th>
                  <th className="px-3 py-2 text-left">จังหวัด</th>
                  <th className="px-3 py-2 text-left">สร้างเมื่อ</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-blue-50/40">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={(e) => toggleOne(r.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-2">{r.plant}</td>
                      <td className="px-3 py-2">{r.branch}</td>
                      <td className="px-3 py-2">{r.house}</td>
                      <td className="px-3 py-2">{r.farm_name ?? "-"}</td>
                      <td className="px-3 py-2">{r.subdistrict ?? "-"}</td>
                      <td className="px-3 py-2">{r.district ?? "-"}</td>
                      <td className="px-3 py-2">{r.province ?? "-"}</td>
                      <td className="px-3 py-2">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => approve([r.id])}
                          className="text-blue-700 hover:underline disabled:opacity-60"
                          disabled={loading}
                        >
                          อนุมัติ
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-4 text-gray-500 text-center"
                    >
                      ไม่มีฟาร์มสถานะ <b>pending</b>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
