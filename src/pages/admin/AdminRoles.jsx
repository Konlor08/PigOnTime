import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function AdminRoles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!supabase) {
        setMsg("ยังไม่ได้ตั้งค่า Supabase (แสดงข้อมูลตัวอย่างแทน)");
        setProfiles([
          { id: "demo-1", full_name: "Demo User", role: "Admin" },
          { id: "demo-2", full_name: "AH 1", role: "AnimalHusbandry" },
        ]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .limit(50);
      if (error) setMsg(error.message);
      setProfiles(data || []);
      setLoading(false);
    };
    run();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin — Roles</h1>
      {msg && <p className="mb-3 text-orange-600">{msg}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : profiles.length === 0 ? (
        <p>No profiles.</p>
      ) : (
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2 border">ID</th>
              <th className="p-2 border">Full Name</th>
              <th className="p-2 border">Role</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td className="p-2 border">{p.id}</td>
                <td className="p-2 border">{p.full_name}</td>
                <td className="p-2 border">{p.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
