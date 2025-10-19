// src/pages/admin/AdminUsers.jsx
import { useEffect, useMemo, useState } from "react";
import supabase from "../../supabaseClient.js";

const ROLES = [
  "Admin",
  "AnimalHusbandry",
  "Planning",
  "Factory",
  "Catching",
  "Driver",
  "Manager",
];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const { data, error } = await supabase
        .from("app_users")
        .select("id, full_name, role, pin, status, email, password")
        .order("full_name", { ascending: true });
      if (error) throw error;
      setUsers(
        (data || []).map((u) => ({
          ...u,
          _role: u.role || "",
        }))
      );
    } catch (e) {
      console.error(e);
      setErr("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.full_name, u.role, u.pin, u.status, u.email]
        .map((x) => String(x ?? "").toLowerCase())
        .some((s) => s.includes(q))
    );
  }, [search, users]);

  const saveRole = async (u) => {
    try {
      setLoading(true);
      setErr("");
      const { error } = await supabase
        .from("app_users")
        .update({ role: u._role })
        .eq("id", u.id);
      if (error) throw error;
      await load();
    } catch (e) {
      console.error(e);
      setErr("บันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const setInactive = async (u) => {
    if (!window.confirm(`ตั้งสถานะของ ${u.full_name} เป็น inactive ใช่ไหม?`))
      return;
    try {
      const { error } = await supabase
        .from("app_users")
        .update({ status: "inactive" })
        .eq("id", u.id);
      if (error) throw error;
      await load();
    } catch (e) {
      console.error(e);
      setErr("ไม่สามารถตั้งสถานะได้");
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`ต้องการลบผู้ใช้ ${u.full_name}?`)) return;
    try {
      const { error } = await supabase
        .from("app_users")
        .delete()
        .eq("id", u.id);
      if (error) throw error;
      await load();
    } catch (e) {
      console.error(e);
      setErr("ไม่สามารถลบผู้ใช้ได้");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Users</h1>
          <button
            onClick={() => (window.location.href = "/admin")}
            className="bg-white/20 px-4 py-2 rounded hover:bg-white/30"
          >
            Back to Admin
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {err && (
          <div className="mb-4 bg-red-100 text-red-700 px-4 py-2 rounded">
            {err}
          </div>
        )}

        <div className="flex justify-between mb-4">
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name / role / PIN / status"
            className="border rounded px-3 py-2 w-72 text-sm"
          />
        </div>

        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Full name</th>
                <th className="px-4 py-2 text-left">PIN</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Password</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{u.full_name}</td>
                  <td className="px-4 py-2">{u.pin}</td>
                  <td className="px-4 py-2 text-gray-600">{u.email || "-"}</td>
                  <td className="px-4 py-2 text-gray-400 italic">
                    {u.password || "-"}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={u._role}
                      onChange={(e) =>
                        setUsers((prev) =>
                          prev.map((x) =>
                            x.id === u.id ? { ...x, _role: e.target.value } : x
                          )
                        )
                      }
                      className="border rounded px-2 py-1"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        u.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => saveRole(u)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Save role
                    </button>
                    <button
                      onClick={() => setInactive(u)}
                      className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                    >
                      Set Inactive
                    </button>
                    <button
                      onClick={() => deleteUser(u)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    ไม่มีข้อมูลผู้ใช้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
