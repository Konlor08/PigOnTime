// src/pages/AHCatchTeamLite.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";

/* ---------- Banner (success 3s / error ค้าง) ---------- */
function Banner({ type = "info", children }) {
  const color =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`mb-4 rounded-lg border px-3 py-2 ${color}`}>{children}</div>;
}

/* ---------- utils ---------- */
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const plusDaysISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const norm = (s) =>
  String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

function farmLabel(f) {
  if (!f) return "";
  const code = [f.plant, f.branch, f.house].filter(Boolean).join(" / ");
  return `${code} ${f.farm_name || ""}`.trim();
}

/* ---------- รายการคิว + แถบสี ---------- */
function SearchBox({ list, value, onChange }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((x) =>
      [x.date, x.factory, farmLabel(x.farm)].join(" ").toLowerCase().includes(s)
    );
  }, [q, list]);

  return (
    <div className="rounded-xl border bg-white/90 p-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหา (วันที่/ฟาร์ม/โรงงาน)"
        className="mb-2 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <div className="max-h-80 overflow-auto space-y-2">
        {results.map((g) => (
          <button
            key={g.group_key}
            onClick={() => onChange(g)}
            type="button"
            className={`block w-full text-left rounded-md px-3 pb-2 pt-0 border overflow-hidden ${
              value?.group_key === g.group_key ? "ring-2 ring-emerald-500" : ""
            }`}
          >
            {/* แถบสีด้านบน */}
            <div className="h-1 w-full bg-emerald-600 mb-2" />
            <div className="font-medium">
              {g.date} • {farmLabel(g.farm)}
            </div>
            <div className="text-xs text-gray-600">
              โรงงาน: {g.factory || "-"} · แผน {g.plan_count} รอบ
            </div>
          </button>
        ))}
        {!results.length && <div className="text-center text-gray-500 py-6">ไม่พบข้อมูล</div>}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function AHCatchTeamLite() {
  // อ่านผู้ใช้จาก localStorage
  let me = null;
  try {
    me = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    me = null;
  }

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [groups, setGroups] = useState([]);
  const [sel, setSel] = useState(null);

  const [teamCount, setTeamCount] = useState("");
  const [memberCount, setMemberCount] = useState("");
  const [note, setNote] = useState("");

  const onAnyAction = (fn) => async (...args) => {
    if (err) setErr(""); // error ค้างไว้จนกดปุ่มใดๆ
    return fn?.(...args);
  };

  /* โหลดคิว: วันนี้ → +7 วัน และเฉพาะรายการที่ยัง "ไม่เคยยืนยัน" */
  const loadPending = useCallback(async () => {
    setErr("");
    setBusy(true);
    try {
      if (!me?.id) throw new Error("ไม่พบผู้ใช้ปัจจุบัน");

      // 1) ฟาร์มที่ฉันดูแล (active)
      const { data: rel, error: e1 } = await supabase
        .from("ah_farm_relations")
        .select("farm_id, farm:farms(id, plant, branch, house, farm_name)")
        .eq("ah_id", me.id)
        .eq("status", "active");
      if (e1) throw e1;
      const myFarms = (rel || []).map((r) => r.farm).filter(Boolean);
      const farmById = new Map(myFarms.map((f) => [f.id, f]));

      // 2) แผนช่วงวันนี้..+7
      const start = todayISO();
      const end = plusDaysISO(7);
      const { data: plans, error: e2 } = await supabase
        .from("planning_plan_full")
        .select("id, delivery_date, plant, branch, house, farm_name, factory, farm_id")
        .gte("delivery_date", start)
        .lte("delivery_date", end);
      if (e2) throw e2;

      // 3) รวมเป็น group (วัน::ฟาร์ม)
      const map = new Map();
      for (const p of plans || []) {
        let f = null;
        if (p.farm_id) f = farmById.get(p.farm_id);
        if (!f) {
          f = myFarms.find(
            (x) =>
              norm(x.plant) === norm(p.plant) &&
              norm(x.branch) === norm(p.branch) &&
              norm(x.house) === norm(p.house) &&
              norm(x.farm_name) === norm(p.farm_name)
          );
        }
        if (!f) continue; // ไม่ใช่ฟาร์มในความดูแล

        const date = iso(p.delivery_date);
        const key = `${date}::${f.id}`;
        const cur =
          map.get(key) || { group_key: key, date, farm: f, factory: p.factory || null, plan_count: 0 };
        cur.plan_count += 1;
        map.set(key, cur);
      }

      const all = Array.from(map.values());
      if (!all.length) {
        setGroups([]);
        setBusy(false);
        return;
      }

      // 4) เอาเฉพาะที่ "ยังไม่เคยยืนยัน"
      const { data: confs } = await supabase
        .from("plan_catcher_confirms")
        .select("group_key");
      const done = new Set((confs || []).map((x) => x.group_key));

      const pending = all
        .filter((g) => !done.has(g.group_key))
        .sort((a, b) => a.date.localeCompare(b.date));

      setGroups(pending);
    } catch (e) {
      setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }, [me?.id]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  /* เมื่อเลือก group → เคลียร์แบบฟอร์ม */
  useEffect(() => {
    setTeamCount("");
    setMemberCount("");
    setNote("");
  }, [sel?.group_key]);

  /* บันทึกยืนยัน */
  const onSave = async () => {
    setErr("");
    setMsg("");

    if (!sel) return setErr("ยังไม่ได้เลือกรายการ");
    const t = Number(teamCount);
    if (!t || t < 1 || t > 50) return setErr("จำนวนทีมต้องเป็นเลข 1–50");
    const m = memberCount ? Number(memberCount) : null;
    if (m !== null && (Number.isNaN(m) || m < 1))
      return setErr("จำนวนคนต่อทีมต้องเป็นเลข ≥ 1");

    setBusy(true);
    try {
      const { error: ei } = await supabase.from("plan_catcher_confirms").insert({
        group_key: sel.group_key,
        delivery_date: sel.date,
        farm_id: sel.farm.id,
        ah_id: me?.id || null,
        team_count: t,
        member_count: m,
        note: note || null,
      });
      if (ei) throw ei;

      setMsg("บันทึกยืนยันสำเร็จ");
      setTimeout(() => setMsg(""), 3000); // success 3 วินาที

      // เอารายการนี้ออกจากคิว
      setGroups((old) => old.filter((g) => g.group_key !== sel.group_key));
      setSel(null);
      setTeamCount("");
      setMemberCount("");
      setNote("");
    } catch (e) {
      setErr(e.message || "บันทึกไม่สำเร็จ"); // ค้างไว้จนกดปุ่มใดๆ
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50">
      <header className="bg-emerald-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">ยืนยันจำนวนทีมจับสุกร (คิววันนี้ → +7 วัน)</h1>
          <Link to="/ah" className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/20">
            กลับหน้า Animal husbandry
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {err && <Banner type="error">{err}</Banner>}
        {msg && <Banner type="success">{msg}</Banner>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* คิวที่ยังไม่ได้ยืนยัน */}
          <div className="md:col-span-2">
            <div className="font-semibold mb-2">คิวที่ยังไม่ได้ทำ (วันนี้ → ล่วงหน้า 7 วัน)</div>
            <SearchBox list={groups} value={sel} onChange={setSel} />
            {busy && <div className="text-gray-500 mt-3">กำลังโหลด…</div>}
            {!busy && !groups.length && <div className="text-gray-500 mt-3">ไม่มีคิวค้าง</div>}
          </div>

          {/* ฟอร์มยืนยัน */}
          <div className="space-y-3">
            <div className="rounded-xl border bg-white/90 p-3">
              <div className="font-semibold mb-2">ยืนยันจำนวนทีม</div>
              <div className="text-sm text-gray-700">
                วันที่: <b>{sel?.date || "-"}</b>
                <br />
                ฟาร์ม: <b>{sel ? farmLabel(sel.farm) : "-"}</b>
              </div>

              <label className="block text-sm text-gray-600 mt-3">จำนวนทีม (ทีม)</label>
              <input
                value={teamCount}
                onChange={(e) => setTeamCount(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="เช่น 2"
                className="mb-3 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <label className="block text-sm text-gray-600">จำนวนคนต่อทีม (คน) — ไม่บังคับ</label>
              <input
                value={memberCount}
                onChange={(e) => setMemberCount(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="เช่น 6"
                className="mb-3 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <label className="block text-sm text-gray-600">หมายเหตุ</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น ขอเพิ่มทีมเพราะจำนวนสุกรมาก"
                className="mb-3 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onAnyAction(onSave)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={busy || !sel || !teamCount}
                >
                  บันทึกยืนยัน
                </button>
                <button
                  type="button"
                  onClick={onAnyAction(() => {
                    setTeamCount("");
                    setMemberCount("");
                    setNote("");
                  })}
                  className="rounded-md bg-gray-200 px-4 py-2 hover:bg-gray-300"
                >
                  ล้างฟอร์ม
                </button>
              </div>

              <div className="text-xs text-gray-500 mt-2">
                * แสดงเฉพาะรายการที่ยังไม่ได้ยืนยันในช่วงวันนี้ถึงอีก 7 วัน
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
