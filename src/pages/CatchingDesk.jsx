// src/pages/CatchingDesk.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";

/* ---------- helpers ---------- */
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/* small badge */
function Pill({ children, color = "slate" }) {
  const map = {
    green: "bg-green-100 text-green-800 border-green-200",
    red: "bg-rose-100 text-rose-800 border-rose-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${map[color]}`}>
      {children}
    </span>
  );
}

/* ---------- main ---------- */
export default function CatchingDesk() {
  const navigate = useNavigate();

  // session (อ่านจาก localStorage)
  let me = null;
  try {
    me = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    me = null;
  }

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [rows, setRows] = useState([]); // คิวแสดงผล
  const [query, setQuery] = useState(""); // ค้นหา
  const [showDone, setShowDone] = useState(false); // (ยังคงไว้ เผื่อใช้ต่อ แต่ตอนนี้ไม่กรองจาก view เดิม)

  const [teamCount, setTeamCount] = useState(0);
  const [note, setNote] = useState("");

  // modal เอกสาร
  const [docOpen, setDocOpen] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [docErr, setDocErr] = useState("");
  const [docAlbum, setDocAlbum] = useState(null); // {id, returned_for_fix, return_reason, farm_id, delivery_date}
  const [docFiles, setDocFiles] = useState([]); // [{id, file_name, file_url, ...}]
  const [returnReason, setReturnReason] = useState("");

  const start = todayISO();
  const end = plusDaysISO(7);

  /* toast */
  const toastOk = (m) => {
    setOk(m);
    const t = setTimeout(() => setOk(""), 3000);
    return () => clearTimeout(t);
  };
  const toastErr = (m) => setErr(m);

  /* โหลดคิว + รวมสถานะเอกสารจาก AH
     !!! ปรับเท่าที่จำเป็น: ใช้ v_plan_queue_simple แทน v_catching_queue_status  */
  const loadQueues = useCallback(async () => {
    setErr("");
    setBusy(true);
    try {
      if (!me?.id) throw new Error("ไม่พบผู้ใช้ปัจจุบัน");

      // 1) ดึงคิวภายในช่วงวันนี้→+7 วัน จาก view ใหม่
      const { data, error } = await supabase
        .from("v_plan_queue_simple")
        .select(
          [
            "plan_id",
            "delivery_date",
            "plant",
            "branch",
            "house",
            "farm_name",
            "factory",
            "fasting",
            "delivery_time",
            "timetrucktofarm",
            "catch_time",
            "arrive_factory_time",
            "farm_id",
          ].join(", ")
        )
        .gte("delivery_date", start)
        .lte("delivery_date", end)
        .order("delivery_date", { ascending: true })
        .order("plant", { ascending: true })
        .order("branch", { ascending: true })
        .order("house", { ascending: true });

      if (error) throw error;
      const baseRows = data || [];

      // 2) โหลดสถานะเอกสารจาก AH ตามฟาร์ม/ช่วงวันที่ที่เกี่ยวข้อง
      const farmIds = Array.from(new Set(baseRows.map((r) => r.farm_id).filter(Boolean)));
      let docMap = new Map(); // key: `${farm_id}|${delivery_date}` -> 'need_fix'|'ok'|'none'
      if (farmIds.length) {
        const { data: docs, error: eDoc } = await supabase
          .from("plan_doc_albums")
          .select("farm_id, delivery_date, returned_for_fix")
          .in("farm_id", farmIds)
          .gte("delivery_date", start)
          .lte("delivery_date", end);
        if (eDoc) throw eDoc;

        (docs || []).forEach((d) => {
          const k = `${d.farm_id}|${d.delivery_date}`;
          docMap.set(k, d.returned_for_fix ? "need_fix" : "ok");
        });
      }

      // 3) รวมสถานะเอกสาร
      const merged = baseRows.map((r) => {
        const k = `${r.farm_id}|${r.delivery_date}`;
        return { ...r, ah_doc_status: docMap.get(k) || "none" };
      });

      setRows(merged);
    } catch (e) {
      setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }, [me?.id, start, end]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  /* filter โดยคำค้น */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.delivery_date, r.farm_name, r.plant, r.branch, r.house, r.factory]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  /* บันทึกสถานะตรวจเอกสาร (ของ catcher) – คงโค้ดเดิมไว้ */
  const markStatus = async (plan_id, status) => {
    setErr("");
    setBusy(true);
    try {
      const { error } = await supabase.from("catching_reviews").insert({
        plan_id,
        status,
        note: note || null,
        checked_by: me.id,
      });
      if (error) throw error;
      setNote("");
      toastOk("บันทึกสถานะเรียบร้อย");
      loadQueues();
    } catch (e) {
      toastErr(e.message || "บันทึกสถานะไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  /* เริ่มจับ */
  const startCatching = async (plan_id) => {
    setErr("");
    setBusy(true);
    try {
      const { error } = await supabase.from("catching_sessions").insert({
        plan_id,
        team_count: Number(teamCount) || 0,
        start_at: new Date().toISOString(),
        created_by: me.id,
      });
      if (error) throw error;
      toastOk("เริ่มจับแล้ว");
      loadQueues();
    } catch (e) {
      toastErr(e.message || "เริ่มจับไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  /* จบจับ */
  const finishCatching = async (plan_id) => {
    setErr("");
    setBusy(true);
    try {
      const { error: e1 } = await supabase.from("catching_sessions").insert({
        plan_id,
        team_count: Number(teamCount) || 0,
        end_at: new Date().toISOString(),
        created_by: me.id,
      });
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("catching_reviews").insert({
        plan_id,
        status: "finished",
        checked_by: me.id,
      });
      if (e2) throw e2;

      toastOk("ปิดคิวสำเร็จ");
      loadQueues();
    } catch (e) {
      toastErr(e.message || "ปิดคิวไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  /* ---------- เอกสารจาก AH: modal ---------- */
  const openDocs = async (farm_id, delivery_date) => {
    setDocErr("");
    setDocBusy(true);
    setDocAlbum(null);
    setDocFiles([]);
    setReturnReason("");
    setDocOpen(true);

    try {
      // หาอัลบั้มตามฟาร์ม+วันที่
      const { data: albums, error: e1 } = await supabase
        .from("plan_doc_albums")
        .select("id, farm_id, delivery_date, returned_for_fix, return_reason")
        .eq("farm_id", farm_id)
        .eq("delivery_date", delivery_date)
        .limit(1);
      if (e1) throw e1;

      const album = (albums && albums[0]) || null;
      if (!album) {
        setDocAlbum(null);
        setDocFiles([]);
        setDocBusy(false);
        return;
      }
      setDocAlbum(album);

      // โหลดไฟล์ในอัลบั้ม
      const { data: files, error: e2 } = await supabase
        .from("plan_doc_files")
        .select("id, file_name, file_url, mime_type, file_bytes, created_at")
        .eq("album_id", album.id)
        .order("created_at", { ascending: true });
      if (e2) throw e2;

      setDocFiles(files || []);
    } catch (e) {
      setDocErr(e.message || "โหลดเอกสารไม่สำเร็จ");
    } finally {
      setDocBusy(false);
    }
  };

  const closeDocs = () => {
    setDocOpen(false);
    setDocAlbum(null);
    setDocFiles([]);
    setReturnReason("");
    setDocErr("");
  };

  const markDocCorrect = async () => {
    if (!docAlbum?.id) return;
    setDocErr("");
    setDocBusy(true);
    try {
      const { error } = await supabase
        .from("plan_doc_albums")
        .update({ returned_for_fix: false, return_reason: null })
        .eq("id", docAlbum.id);
      if (error) throw error;

      toastOk("ยืนยันเอกสารถูกต้องแล้ว");
      closeDocs();
      loadQueues();
    } catch (e) {
      setDocErr(e.message || "อัปเดตสถานะเอกสารไม่สำเร็จ");
    } finally {
      setDocBusy(false);
    }
  };

  const markDocIncorrect = async () => {
    if (!docAlbum?.id) return;
    const reason = String(returnReason || "").trim();
    if (!reason) {
      setDocErr("กรุณาระบุเหตุผลที่ไม่ถูกต้อง");
      return;
    }
    setDocErr("");
    setDocBusy(true);
    try {
      const { error } = await supabase
        .from("plan_doc_albums")
        .update({ returned_for_fix: true, return_reason: reason })
        .eq("id", docAlbum.id);
      if (error) throw error;

      toastOk("ส่งกลับแก้ไขให้ Animal husbandry แล้ว");
      closeDocs();
      loadQueues();
    } catch (e) {
      setDocErr(e.message || "อัปเดตสถานะเอกสารไม่สำเร็จ");
    } finally {
      setDocBusy(false);
    }
  };

  /* logout */
  const doLogout = () => {
    try {
      localStorage.removeItem("user");
      // eslint-disable-next-line no-empty
    } catch {}
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="bg-amber-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Catching Desk</h1>

          {/* ปุ่ม Logout สีเหลือง */}
          <button
            type="button"
            onClick={doLogout}
            className="rounded-md bg-amber-300 text-amber-950 px-4 py-2 font-semibold hover:bg-amber-400 active:bg-amber-500"
            title="ออกจากระบบ"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 flex items-center justify-between">
            <span>{err}</span>
            <button className="text-red-700" onClick={() => setErr("")}>
              ×
            </button>
          </div>
        )}
        {ok && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
            {ok}
          </div>
        )}

        {/* แถบตัวกรอง */}
        <div className="rounded-xl border border-amber-200 bg-white p-3 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="space-x-2">
            <Pill color="amber">วันนี้: {fmtDate(start)}</Pill>
            <Pill>ถึง: {fmtDate(end)}</Pill>
          </div>
          <div className="flex gap-2 items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหา (วันที่/ฟาร์ม/plant-branch-house/โรงงาน)"
              className="rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500 w-72"
            />
            <button
              type="button"
              onClick={loadQueues}
              className="rounded-md bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-60"
              disabled={busy}
            >
              รีเฟรช
            </button>
          </div>
        </div>

        {/* รายการคิว */}
        <div className="space-y-3">
          {busy && <div className="text-gray-500">กำลังโหลด…</div>}
          {!busy && filtered.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-white p-4 text-gray-600">
              ไม่พบคิวตามเงื่อนไข
            </div>
          )}

          {filtered.map((r) => {
            const isToday = r.delivery_date === start;
            const canEdit = isToday; // ปุ่มเริ่ม/จบ เฉพาะวันนี้
            const canOpenDocs = r.ah_doc_status !== "none";

            return (
              <div key={r.plan_id} className="rounded-xl border border-amber-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {r.delivery_date} • {r.plant} / {r.branch} / {r.house} — {r.farm_name || "-"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill color={r.ah_doc_status === "need_fix" ? "red" : r.ah_doc_status === "ok" ? "green" : "slate"}>
                      Animal husbandry Docs: {r.ah_doc_status}
                    </Pill>
                    <button
                      type="button"
                      disabled={!canOpenDocs}
                      onClick={() => openDocs(r.farm_id, r.delivery_date)}
                      className={`rounded-md px-3 py-1.5 text-sm border ${
                        canOpenDocs
                          ? "bg-amber-50 border-amber-300 hover:bg-amber-100"
                          : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                      title={canOpenDocs ? "เปิดดูเอกสาร Animal husbandry" : "ไม่มีอัลบั้มเอกสารในวันนี้"}
                    >
                      ดูเอกสาร
                    </button>
                  </div>
                </div>

                {/* เวลาสำคัญ */}
                <div className="mt-2 text-sm text-gray-700">
                  โรงงาน: <b>{r.factory || "-"}</b>
                  <div className="text-xs text-gray-600 mt-1">
                    อดอาหาร: <b>{r.fasting ?? "-"}</b> · เวลาแผน: <b>{r.delivery_time ?? "-"}</b> · เวลาไปฟาร์ม:{" "}
                    <b>{r.timetrucktofarm ?? "-"}</b> · เวลาจับ: <b>{r.catch_time ?? "-"}</b> · ถึงโรงงาน:{" "}
                    <b>{r.arrive_factory_time ?? "-"}</b>
                  </div>
                </div>

                {/* แผงบันทึก/ควบคุม */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-amber-200 p-3">
                    <div className="text-sm text-gray-600 mb-1">หมายเหตุ/ข้อสังเกต</div>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
                      rows={2}
                      placeholder="บันทึกเพื่ออ้างอิงเปลี่ยนสถานะ (ถ้ามี)"
                      disabled={!canEdit}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busy || !canEdit}
                        onClick={() => markStatus(r.plan_id, "approved")}
                        className="rounded-md bg-amber-600 px-3 py-2 text-white hover:bg-amber-700 disabled:opacity-60"
                        title={canEdit ? "" : "อนุมัติได้เฉพาะวันคิววันนี้"}
                      >
                        อนุมัติเอกสาร
                      </button>
                      <button
                        type="button"
                        disabled={busy || !canEdit}
                        onClick={() => markStatus(r.plan_id, "need_fix")}
                        className="rounded-md bg-amber-500 px-3 py-2 text-white hover:bg-amber-600 disabled:opacity-60"
                      >
                        ส่งกลับแก้ไข
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-200 p-3">
                    <div className="text-sm text-gray-600 mb-1">ทีมจับสุกร (เริ่ม/จบ ได้เฉพาะวันนี้)</div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        value={teamCount}
                        onChange={(e) => setTeamCount(e.target.value)}
                        placeholder="จำนวนคน"
                        className="w-32 rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
                        disabled={!canEdit}
                      />
                      <button
                        type="button"
                        disabled={busy || !canEdit}
                        onClick={() => startCatching(r.plan_id)}
                        className="rounded-md bg-amber-600 px-3 py-2 text-white hover:bg-amber-700 disabled:opacity-60"
                      >
                        เริ่มจับ
                      </button>
                      <button
                        type="button"
                        disabled={busy || !canEdit}
                        onClick={() => finishCatching(r.plan_id)}
                        className="rounded-md bg-rose-600 px-3 py-2 text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        จบจับ / ปิดคิว
                      </button>
                    </div>
                  </div>
                </div>

                {!canEdit && (
                  <div className="mt-2 text-xs text-gray-500">
                    * บันทึกได้เฉพาะคิววันที่ {fmtDate(start)} (วันนี้) — วันอื่นดูอย่างเดียว
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* ---------- Modal ดูเอกสาร AH ---------- */}
      {docOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow border border-amber-200">
            <div className="px-4 py-3 bg-amber-100 border-b border-amber-200 rounded-t-xl flex items-center justify-between">
              <div className="font-semibold">เอกสารจาก Animal husbandry</div>
              <button onClick={closeDocs} className="rounded-md px-2 py-1 border border-amber-300 hover:bg-amber-200">
                ปิด
              </button>
            </div>

            <div className="p-4 space-y-3">
              {docErr && (
                <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">{docErr}</div>
              )}

              {docBusy ? (
                <div className="text-gray-500">กำลังโหลดเอกสาร…</div>
              ) : !docAlbum ? (
                <div className="text-gray-600">ไม่พบอัลบั้มเอกสารสำหรับฟาร์ม/วันที่นี้</div>
              ) : (
                <>
                  <div className="text-sm text-gray-700">
                    วันที่: <b>{docAlbum.delivery_date}</b> · สถานะ:{" "}
                    {docAlbum.returned_for_fix ? <Pill color="red">need_fix</Pill> : <Pill color="green">ok</Pill>}
                  </div>

                  <div className="rounded border border-amber-200">
                    <div className="px-3 py-2 bg-amber-50 border-b">ไฟล์เอกสาร</div>
                    {docFiles.length ? (
                      <ul className="max-h-64 overflow-auto divide-y">
                        {docFiles.map((f) => (
                          <li key={f.id} className="px-3 py-2 flex items-center justify-between">
                            <div className="truncate">
                              <div className="font-medium truncate">{f.file_name}</div>
                              <div className="text-xs text-gray-500">
                                {f.mime_type || "-"} · {f.file_bytes ? `${f.file_bytes} bytes` : ""}
                              </div>
                            </div>
                            <a href={f.file_url} target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">
                              เปิด
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-3 py-6 text-center text-gray-500">ยังไม่มีไฟล์</div>
                    )}
                  </div>

                  {/* ปุ่มผลการรีวิว */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <button
                      type="button"
                      onClick={markDocCorrect}
                      disabled={docBusy || !docAlbum?.id}
                      className="rounded-md bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700 disabled:opacity-60"
                    >
                      ถูกต้อง
                    </button>

                    <div className="flex-1 flex items-center gap-2">
                      <input
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        placeholder="เหตุผลที่ไม่ถูกต้อง (จำเป็น)"
                        className="flex-1 rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={markDocIncorrect}
                        disabled={docBusy || !docAlbum?.id}
                        className="rounded-md bg-rose-600 text-white px-4 py-2 hover:bg-rose-700 disabled:opacity-60"
                      >
                        ไม่ถูกต้อง
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
