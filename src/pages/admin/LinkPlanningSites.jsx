// src/pages/admin/LinkPlanningSites.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../../lib/supabaseClient";

/**
 * ตารางที่ต้องมีใน DB:
 *
 * create table if not exists public.planning_site_relations (
 *   planner_id uuid not null references public.app_users(id) on delete cascade,
 *   site text not null,
 *   status text not null default 'active',
 *   created_at timestamp without time zone not null default now(),
 *   primary key (planner_id, site)
 * );
 * -- อาศัยตาราง factories(site primary key) ที่มีอยู่แล้ว
 */

export default function LinkPlanningSites() {
  const [planners, setPlanners] = useState([]); // app_users (role='Planning')
  const [sites, setSites] = useState([]);       // จาก factories.site
  const [links, setLinks] = useState([]);       // [{planner_id, site, status}]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");               // ค้นหา planner

  const filteredPlanners = useMemo(() => {
    if (!q) return planners;
    const s = q.trim().toLowerCase();
    return planners.filter(
      (p) =>
        (p.full_name || "").toLowerCase().includes(s) ||
        (p.phone || "").toLowerCase().includes(s) ||
        (p.email || "").toLowerCase().includes(s)
    );
  }, [q, planners]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // 1) planners (role: Planning)
      const { data: plannerRows, error: e1 } = await supabase
        .from("app_users")
        .select("id, full_name, phone, email, role, active")
        .eq("role", "Planning")
        .order("full_name", { ascending: true });
      if (e1) console.error(e1);

      // 2) factories -> sites
      const { data: facRows, error: e2 } = await supabase
        .from("factories")
        .select("site, name")
        .order("site", { ascending: true })
        .limit(2000);
      if (e2) console.error(e2);

      // 3) existing links
      const { data: linkRows, error: e3 } = await supabase
        .from("planning_site_relations")
        .select("planner_id, site, status");
      if (e3) console.error(e3);

      setPlanners(plannerRows || []);
      setSites(facRows || []);
      setLinks(linkRows || []);
      setLoading(false);
    })();
  }, []);

  function sitesOfPlanner(pid) {
    return links
      .filter((x) => x.planner_id === pid && (x.status || "active") === "active")
      .map((x) => x.site);
  }

  async function addSite(pid, site) {
    if (!pid || !site) return;
    setSaving(true);
    try {
      // upsert: ถ้ามีอยู่แล้ว จะ set ให้เป็น active
      const { error } = await supabase
        .from("planning_site_relations")
        .upsert([{ planner_id: pid, site, status: "active" }], { onConflict: "planner_id,site" });
      if (error) throw error;

      setLinks((old) => {
        const key = (x) => `${x.planner_id}|${x.site}`;
        const next = [
          ...old.filter((x) => key(x) !== `${pid}|${site}`),
          { planner_id: pid, site, status: "active" },
        ];
        return next;
      });
    } catch (e) {
      alert(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function removeSite(pid, site) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("planning_site_relations")
        .delete()
        .match({ planner_id: pid, site });
      if (error) throw error;

      setLinks((old) => old.filter((x) => !(x.planner_id === pid && x.site === site)));
    } catch (e) {
      alert(e.message || "ลบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    // ✅ เปลี่ยนเฉพาะ wrapper/theme ให้เหมือน LinkFactories
    <div className="min-h-screen bg-gray-100">
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <Link to="/admin" className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">Admin — เชื่อม Planner ↔ SITE</h1>
        </div>

        <div className="mb-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา: ชื่อ/เบอร์/อีเมล Planner"
            className="w-full max-w-md border rounded px-3 py-2 bg-white"
          />
        </div>

        {loading ? (
          <p>กำลังโหลด...</p>
        ) : (
          <div className="overflow-x-auto border rounded bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Planner</th>
                  <th className="p-2 text-left">อีเมล / เบอร์</th>
                  <th className="p-2 text-left">SITE ที่ดูได้</th>
                  <th className="p-2 text-left">เพิ่ม SITE</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlanners.map((p) => {
                  const current = sitesOfPlanner(p.id);
                  return (
                    <tr key={p.id} className="border-t align-top">
                      <td className="p-2">
                        <div className="font-medium">{p.full_name || "(ไม่มีชื่อ)"}</div>
                        <div className="text-xs text-gray-500">
                          {p.active ? "active" : "inactive"} · role: {p.role}
                        </div>
                      </td>
                      <td className="p-2">
                        <div>{p.email || "-"}</div>
                        <div className="text-xs text-gray-500">{p.phone || "-"}</div>
                      </td>
                      <td className="p-2">
                        {current.length ? (
                          <div className="flex flex-wrap gap-2">
                            {current.map((s) => (
                              <span
                                key={`${p.id}-${s}`}
                                className="inline-flex items-center gap-2 px-2 py-1 rounded border bg-gray-50"
                              >
                                <b>{s}</b>
                                <button
                                  onClick={() => removeSite(p.id, s)}
                                  className="text-red-600"
                                  disabled={saving}
                                  title="ลบสิทธิ์ SITE นี้"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">ยังไม่กำหนด</span>
                        )}
                      </td>
                      <td className="p-2">
                        <select
                          className="border rounded px-2 py-1 bg-white"
                          defaultValue=""
                          onChange={(e) => {
                            const site = e.target.value;
                            e.target.value = "";
                            if (site) addSite(p.id, site);
                          }}
                          disabled={saving}
                        >
                          <option value="">— เลือก SITE —</option>
                          {sites.map((fa) => (
                            <option
                              key={fa.site}
                              value={fa.site}
                              disabled={current.includes(fa.site)}
                            >
                              {fa.site} — {fa.name || ""}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
                {filteredPlanners.length === 0 && (
                  <tr>
                    <td className="p-4 text-center text-gray-500" colSpan={4}>
                      ไม่พบ Planner
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {saving && <p className="mt-3 text-sm text-gray-500">กำลังบันทึก…</p>}
      </main>
    </div>
  );
}
