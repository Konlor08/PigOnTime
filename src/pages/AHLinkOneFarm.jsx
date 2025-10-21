import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function AHLinkOneFarm() {
  const [plant, setPlant]   = useState("");
  const [house, setHouse]   = useState("");
  const [branch, setBranch] = useState("");
  const [farm, setFarm]     = useState("");
  const [lat, setLat]       = useState("");
  const [lng, setLng]       = useState("");
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState("");

  async function findFarm() {
    setBusy(true); setMsg("");
    const { data, error } = await supabase
      .from("farms")
      .select("plant, house, branch, farm_name, lat, lng")
      .eq("plant", plant.trim())
      .eq("house", house.trim())
      .eq("branch", branch.trim())
      .eq("farm_name", farm.trim())
      .maybeSingle();

    setBusy(false);
    if (error) { setMsg("ค้นหาฟาร์มผิดพลาด: " + error.message); return; }
    if (!data) { setMsg("ไม่พบฟาร์มตามคีย์ที่ระบุ"); return; }
    setLat(data.lat ?? "");
    setLng(data.lng ?? "");
    setMsg("พบฟาร์มแล้ว สามารถกด Link/Save location ได้");
  }

  async function linkOne() {
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("link_farm", {
      p_plant: plant.trim(),
      p_house: house.trim(),
      p_branch: branch.trim(),
      p_farm_name: farm.trim(),
      p_active: true,
    });
    setBusy(false);
    if (error) { setMsg("ลิงก์ไม่สำเร็จ: " + error.message); return; }
    setMsg("ลิงก์ฟาร์มสำเร็จ ✅");
  }

  async function saveLocation() {
    if (lat === "" || lng === "") { setMsg("กรอก lat/lng ให้ครบก่อน"); return; }
    const latNum = Number(lat), lngNum = Number(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setMsg("lat/lng ต้องเป็นตัวเลข"); return;
    }

    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("update_farm_location", {
      p_plant: plant.trim(),
      p_house: house.trim(),
      p_branch: branch.trim(),
      p_farm_name: farm.trim(),
      p_lat: latNum,
      p_lng: lngNum,
    });
    setBusy(false);
    if (error) { setMsg("บันทึกพิกัดไม่สำเร็จ: " + error.message); return; }
    setMsg("บันทึกพิกัดสำเร็จ ✅");
  }

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Animal husbandry — เพิ่มฟาร์มทีละรายการ & อัปเดตพิกัด</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white border rounded p-4">
        <label className="text-sm">
          Plant
          <input className="mt-1 w-full border rounded px-3 py-2"
                 value={plant} onChange={e=>setPlant(e.target.value)} />
        </label>
        <label className="text-sm">
          House
          <input className="mt-1 w-full border rounded px-3 py-2"
                 value={house} onChange={e=>setHouse(e.target.value)} />
        </label>
        <label className="text-sm">
          Branch
          <input className="mt-1 w-full border rounded px-3 py-2"
                 value={branch} onChange={e=>setBranch(e.target.value)} />
        </label>
        <label className="text-sm md:col-span-2">
          ชื่อฟาร์ม (farm_name)
          <input className="mt-1 w-full border rounded px-3 py-2"
                 value={farm} onChange={e=>setFarm(e.target.value)} />
        </label>

        <div className="md:col-span-2 flex gap-2">
          <button onClick={findFarm} disabled={busy}
                  className="px-4 py-2 rounded bg-slate-700 text-white">
            {busy ? "กำลังค้นหา..." : "ค้นหาฟาร์ม"}
          </button>
          <button onClick={linkOne} disabled={busy}
                  className="px-4 py-2 rounded bg-emerald-600 text-white">
            {busy ? "กำลังลิงก์..." : "Link ฟาร์มนี้กับฉัน"}
          </button>
        </div>

        <label className="text-sm">
          Lat
          <input className="mt-1 w-full border rounded px-3 py-2"
                 value={lat} onChange={e=>setLat(e.target.value)} placeholder="เช่น 14.1234" />
        </label>
        <label className="text-sm">
          Lng
          <input className="mt-1 w-full border rounded px-3 py-2"
                 value={lng} onChange={e=>setLng(e.target.value)} placeholder="เช่น 100.9876" />
        </label>
        <div className="md:col-span-2">
          <button onClick={saveLocation} disabled={busy}
                  className="px-4 py-2 rounded bg-blue-600 text-white">
            {busy ? "กำลังบันทึก..." : "บันทึกพิกัด (lat/lng)"}
          </button>
        </div>
      </div>

      {msg && <p className="mt-4 text-sm text-slate-700">{msg}</p>}
    </main>
  );
}
