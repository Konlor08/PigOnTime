// src/pages/admin/AdminRelations.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import supabase from "../../supabaseClient";

/* ---------- tiny UI ---------- */
function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md px-3 py-2 text-sm border " +
        (active
          ? "bg-blue-600 border-blue-600 text-white"
          : "bg-white hover:bg-gray-50")
      }
    >
      {children}
    </button>
  );
}
function Pill({ on }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
        (on ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700")
      }
    >
      {on ? "active" : "inactive"}
    </span>
  );
}

/** รายการแบบ Search + list (สไตล์รูป 1) */
function SearchList({ title, list, labelKey, selectedId, onSelect, hideSelected = false }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((x) =>
      String(x[labelKey] || "")
        .toLowerCase()
        .includes(s)
    );
  }, [list, q, labelKey]);

  // ซ่อนรายการที่เลือกอยู่ตามพร็อพ (ถ้าต้องการ)
  const visible = hideSelected ? filtered.filter((x) => x.id !== selectedId) : filtered;

  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="text-sm font-medium mb-2">{title}</div>
      <input
        className="mb-2 w-full rounded-md border px-3 py-2 text-sm"
        placeholder="Search..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-[420px] overflow-y-auto rounded-md border">
        {visible.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500">No results</div>
        ) : (
          visible.map((x) => {
            const active = selectedId === x.id;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => onSelect(x.id)}
                title={x[labelKey]}
                aria-selected={active}
                className={
                  "relative block w-full text-left px-3 py-2 text-sm border-b last:border-b-0 " +
                  (active
                    ? "bg-blue-50 border-l-4 border-l-blue-600"
                    : "bg-white hover:bg-gray-50 border-l-4 border-l-transparent")
                }
              >
                <span
                  className={
                    "pointer-events-none absolute left-0 top-0 h-full w-1 " +
                    (active ? "bg-blue-600" : "bg-transparent")
                  }
                />
                {x[labelKey]}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ================= MAIN ================= */
export default function AdminRelations() {
  const [activeTab, setActiveTab] = useState("farm_factory");

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!msg && !err) return;
    const t = setTimeout(() => {
      setMsg("");
      setErr("");
    }, 2500);
    return () => clearTimeout(t);
  }, [msg, err]);

  // ---------- master lists ----------
  const [farms, setFarms] = useState([]); // {id,label}
  const [factories, setFactories] = useState([]); // {id,label}
  const [usersAH, setUsersAH] = useState([]); // {id,label}
  const [usersMgr, setUsersMgr] = useState([]);
  const [usersCatch, setUsersCatch] = useState([]);
  const [usersDriver, setUsersDriver] = useState([]);
  const [trucks, setTrucks] = useState([]);

  const loadFarms = useCallback(async () => {
    const { data, error } = await supabase
      .from("farms")
      .select("id, plant, branch, house, farm_name")
      .order("plant");
    if (error) return setErr(error.message);
    setFarms(
      (data || []).map((f) => ({
        id: f.id,
        label: `${f.plant ?? ""} / ${f.branch ?? ""} / ${f.house ?? ""} / ${f.farm_name ?? ""}`,
      }))
    );
  }, []);

  const loadFactories = useCallback(async () => {
    const { data, error } = await supabase
      .from("factories")
      .select("id, name, branch, site")
      .order("name");
    if (error) return setErr(error.message);
    setFactories(
      (data || []).map((fc) => ({
        id: fc.id,
        label: `${fc.site ?? ""} ${fc.branch ?? ""} ${fc.name ?? ""}`.trim(),
      }))
    );
  }, []);

  const loadUsersByRole = useCallback(async (role, setter) => {
    const { data, error } = await supabase
      .from("app_users")
      .select("id, full_name, email, pin")
      .eq("role", role)
      .order("full_name", { ascending: true });
    if (error) return setErr(error.message);
    setter(
      (data || []).map((u) => ({
        id: u.id,
        label: u.full_name ? `${u.full_name}${u.pin ? ` (${u.pin})` : ""}` : u.email || u.id,
      }))
    );
  }, []);

  const loadTrucks = useCallback(async () => {
    const { data, error } = await supabase
      .from("trucks")
      .select("id, plate")
      .order("plate");
    if (error) return setErr(error.message);
    setTrucks((data || []).map((t) => ({ id: t.id, label: t.plate || t.id })));
  }, []);

  // ---------- relation rows ----------
  const [rowsFF, setRowsFF] = useState([]);
  const [rowsAHF, setRowsAHF] = useState([]);
  const [rowsMgrF, setRowsMgrF] = useState([]);
  const [rowsCatchF, setRowsCatchF] = useState([]);
  const [rowsDT, setRowsDT] = useState([]);

  const loadFF = useCallback(async () => {
    const { data, error } = await supabase
      .from("farm_factory_relations")
      .select("id, farm_id, factory_id, status")
      .order("created_at", { ascending: false });
    if (error) return setErr(error.message);
    setRowsFF(data || []);
  }, []);
  const loadAHF = useCallback(async () => {
    const { data, error } = await supabase
      .from("ah_farm_relations")
      .select("id, ah_id, farm_id, status")
      .order("created_at", { ascending: false });
    if (error) return setErr(error.message);
    setRowsAHF(data || []);
  }, []);
  const loadMgrF = useCallback(async () => {
    const { data, error } = await supabase
      .from("manager_farm_relations")
      .select("id, manager_id, farm_id, status")
      .order("created_at", { ascending: false });
    if (error) return setErr(error.message);
    setRowsMgrF(data || []);
  }, []);
  const loadCatchF = useCallback(async () => {
    const { data, error } = await supabase
      .from("catching_farm_relations")
      .select("id, catching_id, farm_id, status")
      .order("created_at", { ascending: false });
    if (error) return setErr(error.message);
    setRowsCatchF(data || []);
  }, []);
  const loadDT = useCallback(async () => {
    const { data, error } = await supabase
      .from("driver_truck_relations")
      .select("id, idcode, truck_id, status")
      .order("created_at", { ascending: false });
    if (error) return setErr(error.message);
    setRowsDT(data || []);
  }, []);

  // initial
  useEffect(() => {
    (async () => {
      await Promise.all([
        loadFarms(),
        loadFactories(),
        loadUsersByRole("AnimalHusbandry", setUsersAH),
        loadUsersByRole("Manager", setUsersMgr),
        loadUsersByRole("Catching", setUsersCatch),
        loadUsersByRole("Driver", setUsersDriver),
        loadTrucks(),
        loadFF(),
        loadAHF(),
        loadMgrF(),
        loadCatchF(),
        loadDT(),
      ]);
    })();
  }, [
    loadFarms,
    loadFactories,
    loadUsersByRole,
    loadTrucks,
    loadFF,
    loadAHF,
    loadMgrF,
    loadCatchF,
    loadDT,
  ]);

  // ---------- selections ----------
  const [selFarm1, setSelFarm1] = useState("");
  const [selFactory, setSelFactory] = useState("");
  const [selAH, setSelAH] = useState("");
  const [selMgr, setSelMgr] = useState("");
  const [selCatch, setSelCatch] = useState("");
  const [selDriver, setSelDriver] = useState("");
  const [selTruck, setSelTruck] = useState("");

  // helper: หา label จาก list
  const labelOf = (arr, id) => arr.find((x) => x.id === id)?.label || id;

  /* ====== กรองรถที่ driver ที่เลือกใช้อยู่แล้วออก (ห้ามเลือกซ้ำต่อ driver เดียวกัน) ====== */
  const driverUsedTruckIds = useMemo(() => {
    if (!selDriver) return new Set();
    return new Set(
      (rowsDT || [])
        .filter((r) => String(r.status).toLowerCase() === "active" && r.idcode === selDriver)
        .map((r) => r.truck_id)
    );
  }, [rowsDT, selDriver]);

  // 1 รถยังจับคู่ได้หลาย driver -> ไม่กรองตามคนอื่น กรองเฉพาะที่ driver นี้เคยเลือกแล้ว
  const availableTrucks = useMemo(() => {
    return (trucks || []).filter((t) => !driverUsedTruckIds.has(t.id));
  }, [trucks, driverUsedTruckIds]);

  /* ---------- actions ---------- */
  async function addFF() {
    if (!selFarm1 || !selFactory) return setErr("กรุณาเลือก Farm และ Factory");
    setLoading(true);
    try {
      const { error } = await supabase
        .from("farm_factory_relations")
        .insert([{ farm_id: selFarm1, factory_id: selFactory, status: "active" }]);
      if (error) throw error;
      setSelFarm1("");
      setSelFactory("");
      setMsg("Added successfully.");
      await loadFF();
    } catch (e) {
      setErr(e.message || "Add failed");
    } finally {
      setLoading(false);
    }
  }
  async function addAHF() {
    if (!selAH || !selFarm1) return setErr("กรุณาเลือก Animalhusbadry และ Farm");
    setLoading(true);
    try {
      const { error } = await supabase
        .from("ah_farm_relations")
        .insert([{ ah_id: selAH, farm_id: selFarm1, status: "active" }]);
      if (error) throw error;
      setSelAH("");
      setSelFarm1("");
      setMsg("Added successfully.");
      await loadAHF();
    } catch (e) {
      setErr(e.message || "Add failed");
    } finally {
      setLoading(false);
    }
  }
  async function addMgrF() {
    if (!selMgr || !selFarm1) return setErr("กรุณาเลือก Manager และ Farm");
    setLoading(true);
    try {
      const { error } = await supabase
        .from("manager_farm_relations")
        .insert([{ manager_id: selMgr, farm_id: selFarm1, status: "active" }]);
      if (error) throw error;
      setSelMgr("");
      setSelFarm1("");
      setMsg("Added successfully.");
      await loadMgrF();
    } catch (e) {
      setErr(e.message || "Add failed");
    } finally {
      setLoading(false);
    }
  }
  async function addCatchF() {
    if (!selCatch || !selFarm1) return setErr("กรุณาเลือก Catching และ Farm");
    setLoading(true);
    try {
      const { error } = await supabase
        .from("catching_farm_relations")
        .insert([{ catching_id: selCatch, farm_id: selFarm1, status: "active" }]);
      if (error) throw error;
      setSelCatch("");
      setSelFarm1("");
      setMsg("Added successfully.");
      await loadCatchF();
    } catch (e) {
      setErr(e.message || "Add failed");
    } finally {
      setLoading(false);
    }
  }
  async function addDT() {
    if (!selDriver || !selTruck) return setErr("กรุณาเลือก Driver และ Truck");

    // กันการสร้างซ้ำสำหรับ driver เดียวกัน
    const dup = rowsDT.some(
      (r) =>
        r.idcode === selDriver &&
        r.truck_id === selTruck &&
        String(r.status).toLowerCase() === "active"
    );
    if (dup) {
      setErr("คู่นี้ถูกสร้างไว้แล้ว");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("driver_truck_relations")
        .insert([{ idcode: selDriver, truck_id: selTruck, status: "active" }]);
      if (error) throw error;

      // ไม่เคลียร์ driver เพื่อเพิ่มทะเบียนต่อเนื่องได้
      setSelTruck("");
      setMsg("Added successfully.");
      await loadDT();
    } catch (e) {
      setErr(e.message || "Add failed");
    } finally {
      setLoading(false);
    }
  }

  const toggler = (table, reload) => async (id, status) => {
    const to = String(status).toLowerCase() === "active" ? "inactive" : "active";
    const { error } = await supabase.from(table).update({ status: to }).eq("id", id);
    if (error) setErr(error.message);
    else await reload();
  };
  const remover = (table, reload) => async (id) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) setErr(error.message);
    else await reload();
  };

  const toggleFF = toggler("farm_factory_relations", loadFF);
  const toggleAHF = toggler("ah_farm_relations", loadAHF);
  const toggleMgrF = toggler("manager_farm_relations", loadMgrF);
  const toggleCatchF = toggler("catching_farm_relations", loadCatchF);
  const toggleDT = toggler("driver_truck_relations", loadDT);

  const delFF = remover("farm_factory_relations", loadFF);
  const delAHF = remover("ah_farm_relations", loadAHF);
  const delMgrF = remover("manager_farm_relations", loadMgrF);
  const delCatchF = remover("catching_farm_relations", loadCatchF);
  const delDT = remover("driver_truck_relations", loadDT);

  /* ---------- renderer ของตารางผลลัพธ์ ---------- */
  function RelationTable({ headers, rows, renderLeft, renderRight, onToggle, onDelete }) {
    return (
      <div className="mt-6 overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">{headers[0]}</th>
              <th className="px-3 py-2 text-left">{headers[1]}</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={4}>
                  No data
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{renderLeft(r)}</td>
                  <td className="px-3 py-2">{renderRight(r)}</td>
                  <td className="px-3 py-2">
                    <Pill on={String(r.status).toLowerCase() === "active"} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-md bg-indigo-600 px-2.5 py-1 text-white hover:bg-indigo-700"
                        onClick={() => onToggle(r.id, r.status)}
                      >
                        Toggle
                      </button>
                      <button
                        type="button"
                        className="rounded-md border px-2.5 py-1 hover:bg-gray-50"
                        onClick={() => onDelete(r.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Relations</h1>
          <a
            href="/admin"
            className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
          >
            Back to Admin
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Tab active={activeTab === "farm_factory"} onClick={() => setActiveTab("farm_factory")}>
            Farm ↔ Factory
          </Tab>
          <Tab active={activeTab === "ah_farm"} onClick={() => setActiveTab("ah_farm")}>
            Animalhusbandry ↔ Farm
          </Tab>
          <Tab active={activeTab === "manager_farm"} onClick={() => setActiveTab("manager_farm")}>
            Manager ↔ Farm
          </Tab>
          <Tab active={activeTab === "catching_farm"} onClick={() => setActiveTab("catching_farm")}>
            Catching ↔ Farm
          </Tab>
          <Tab active={activeTab === "driver_truck"} onClick={() => setActiveTab("driver_truck")}>
            Driver ↔ Truck
          </Tab>
        </div>

        {msg && (
          <div className="mb-3 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-700">
            {msg}
          </div>
        )}
        {err && (
          <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">
            {err}
          </div>
        )}

        {/* ---------- Farm ↔ Factory ---------- */}
        {activeTab === "farm_factory" && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SearchList
                title="Select Farm —"
                list={farms}
                labelKey="label"
                selectedId={selFarm1}
                onSelect={setSelFarm1}
              />
              <SearchList
                title="Select Factory —"
                list={factories}
                labelKey="label"
                selectedId={selFactory}
                onSelect={setSelFactory}
              />
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={addFF}
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Saving..." : "Create Relation"}
              </button>
            </div>

            <RelationTable
              headers={["Farm", "Factory"]}
              rows={rowsFF}
              renderLeft={(r) => labelOf(farms, r.farm_id)}
              renderRight={(r) => labelOf(factories, r.factory_id)}
              onToggle={toggleFF}
              onDelete={delFF}
            />
          </div>
        )}

        {/* ---------- AH ↔ Farm ---------- */}
        {activeTab === "ah_farm" && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SearchList
                title="Select Animalhusbandry —"
                list={usersAH}
                labelKey="label"
                selectedId={selAH}
                onSelect={setSelAH}
              />
              <SearchList
                title="Select Farm —"
                list={farms}
                labelKey="label"
                selectedId={selFarm1}
                onSelect={setSelFarm1}
              />
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={addAHF}
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Saving..." : "Create Relation"}
              </button>
            </div>

            <RelationTable
              headers={["AH", "Farm"]}
              rows={rowsAHF}
              renderLeft={(r) => labelOf(usersAH, r.ah_id)}
              renderRight={(r) => labelOf(farms, r.farm_id)}
              onToggle={toggleAHF}
              onDelete={delAHF}
            />
          </div>
        )}

        {/* ---------- Manager ↔ Farm ---------- */}
        {activeTab === "manager_farm" && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SearchList
                title="Select Manager —"
                list={usersMgr}
                labelKey="label"
                selectedId={selMgr}
                onSelect={setSelMgr}
              />
              <SearchList
                title="Select Farm —"
                list={farms}
                labelKey="label"
                selectedId={selFarm1}
                onSelect={setSelFarm1}
              />
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={addMgrF}
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Saving..." : "Create Relation"}
              </button>
            </div>

            <RelationTable
              headers={["Manager", "Farm"]}
              rows={rowsMgrF}
              renderLeft={(r) => labelOf(usersMgr, r.manager_id)}
              renderRight={(r) => labelOf(farms, r.farm_id)}
              onToggle={toggleMgrF}
              onDelete={delMgrF}
            />
          </div>
        )}

        {/* ---------- Catching ↔ Farm ---------- */}
        {activeTab === "catching_farm" && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SearchList
                title="Select Catching —"
                list={usersCatch}
                labelKey="label"
                selectedId={selCatch}
                onSelect={setSelCatch}
              />
              <SearchList
                title="Select Farm —"
                list={farms}
                labelKey="label"
                selectedId={selFarm1}
                onSelect={setSelFarm1}
              />
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={addCatchF}
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Saving..." : "Create Relation"}
              </button>
            </div>

            <RelationTable
              headers={["Catching", "Farm"]}
              rows={rowsCatchF}
              renderLeft={(r) => labelOf(usersCatch, r.catching_id)}
              renderRight={(r) => labelOf(farms, r.farm_id)}
              onToggle={toggleCatchF}
              onDelete={delCatchF}
            />
          </div>
        )}

        {/* ---------- Driver ↔ Truck ---------- */}
        {activeTab === "driver_truck" && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SearchList
                title="Select Driver —"
                list={usersDriver}
                labelKey="label"
                selectedId={selDriver}
                onSelect={setSelDriver}
              />
              <SearchList
                title="Select Truck —"
                list={availableTrucks}
                labelKey="label"
                selectedId={selTruck}
                onSelect={setSelTruck}
                hideSelected
              />
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={addDT}
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Saving..." : "Create Relation"}
              </button>
            </div>

            <RelationTable
              headers={["Driver", "Truck"]}
              rows={rowsDT}
              renderLeft={(r) => labelOf(usersDriver, r.idcode)}
              renderRight={(r) => labelOf(trucks, r.truck_id)}
              onToggle={toggleDT}
              onDelete={delDT}
            />
          </div>
        )}
      </main>
    </div>
  );
}
