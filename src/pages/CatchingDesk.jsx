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

const toLocalISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayISO = () => toLocalISODate(new Date());
const plusDaysISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
};

function Pill({ children, color = "slate" }) {
  const map = {
    green: "bg-green-100 text-green-800 border-green-200",
    red: "bg-rose-100 text-rose-800 border-rose-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs ${map[color]}`}
    >
      {children}
    </span>
  );
}

const fmtDT = (iso) =>
  iso
    ? new Date(iso).toLocaleString("th-TH", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "-";
const fmtD = (iso) =>
  iso ? new Date(iso).toLocaleDateString("th-TH") : "-";
const fmtT = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
const diffLabelFromMs = (ms) => {
  const m = Math.round(Math.abs(ms) / 60000);
  if (m === 0) return "ตรงเวลา";
  return ms > 0 ? `ช้ากว่าแผน ${m} นาที` : `เร็วกว่าแผน ${m} นาที`;
};
const diffPlan = (actualIso, planIso) =>
  !actualIso || !planIso
    ? ""
    : diffLabelFromMs(new Date(actualIso) - new Date(planIso));

function parseDocNote(note) {
  const raw = String(note ?? "").trim();
  if (!raw) return { status: "pending", ahNote: "" };
  if (raw === "APPROVED") return { status: "approved", ahNote: "" };
  if (raw.startsWith("REJECT:"))
    return { status: "rejected", reason: raw.slice(7).trim(), ahNote: "" };
  return { status: "pending", ahNote: raw };
}

/** Checklist เอกสารประกอบการจับสุกรเข้าโรงงาน */
const DOC_CHECK_ITEMS = [
  { key: "r3", label: "ใบ ร.3" },
  { key: "mthf", label: "ใบ มฐฟ." },
  { key: "sps", label: "ใบ สพส." },
  { key: "lab_asf", label: "ผล lab ASF" },
  { key: "lab_beta", label: "ผล lab เบต้า" },
  { key: "lab_sulfa", label: "ผล lab ซัลฟา" },
  {
    key: "farm_risk",
    label: "ใบประเมินความเสี่ยงฟาร์ม (กรณีข้ามพื้นที่เขตปศุสัตว์)",
  },
  {
    key: "no_red_meat",
    label: "ใบปลอดสารเร่งเนื้อแดง (กรณีส่งโรงงาน LRSS)",
  },
  { key: "truck_inspect", label: "ใบตรวจสภาพรถขนส่ง" },
  {
    key: "truck_layout",
    label: "ใบแสดงแผนผังสุกรอยู่บนรถขนส่ง",
  },
];

// *** NEW: กลุ่มที่ใช้สำหรับกฎเตือนตอนปิดคิว
const ALWAYS_REQUIRED_KEYS = ["r3", "mthf", "sps", "truck_inspect", "truck_layout"];
const LAB_KEYS = ["lab_asf", "lab_beta", "lab_sulfa"];

const isLRSSFactory = (factory) =>
  String(factory || "").toUpperCase().includes("LRSS");

// TODO: ภายหลังค่อยแมปจาก data จริง ว่าคิวไหนถือว่า "ข้ามเขตปศุสัตว์"
const isCrossZone = (row) => {
  // ตอนนี้ให้เป็น false ไปก่อน
  return false;
};

/* ---------- main ---------- */
export default function CatchingDesk() {
  const navigate = useNavigate();
  let me = null;
  try {
    me = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    me = null;
  }

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [hasFarmAccess, setHasFarmAccess] = useState(null);

  const [teamByPlan, setTeamByPlan] = useState({});
  const [pigByPlan, setPigByPlan] = useState({}); // จำนวนสุกรจับจริงต่อคิว
  const [noteByPlan, setNoteByPlan] = useState({});
  const [lastNoteByPlan, setLastNoteByPlan] = useState({});

  const [docOpen, setDocOpen] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [docErr, setDocErr] = useState("");
  const [docAlbum, setDocAlbum] = useState(null);
  const [docFiles, setDocFiles] = useState([]);
  const [docPlanId, setDocPlanId] = useState(null);

  /** state สำหรับ checklist เอกสารประกอบ (ผูกกับ DB แล้ว) */
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkPlanId, setCheckPlanId] = useState(null);
  const [docChecklistByPlan, setDocChecklistByPlan] = useState({}); // plan_id -> {key: bool}

  const start = todayISO();
  const end = plusDaysISO(7);

  const toastOk = (m) => {
    setOk(m);
    const t = setTimeout(() => setOk(""), 3000);
    return () => clearTimeout(t);
  };
  const toastErr = (m) => setErr(m);

  const DOC_THAI = {
    ok: "เรียบร้อย",
    need_fix: "ตีกลับ",
    none: "รอดำเนินการ",
  };
  const DOC_COLOR = { ok: "green", need_fix: "red", none: "slate" };

  const resolveTeamCount = useCallback(
    (row) => {
      const n1 = Number(teamByPlan[row.plan_id]);
      if (Number.isFinite(n1)) return n1;
      const n2 = Number(row.last_team_count);
      return Number.isFinite(n2) ? n2 : 0;
    },
    [teamByPlan]
  );

  /* โหลดคิว + เอกสาร + เวลาจาก catching_sessions + จำนวนสุกรแผน & จริง + checklist */
  const loadQueues = useCallback(
    async () => {
      setErr("");
      setBusy(true);
      try {
        if (!me?.id) throw new Error("ไม่พบผู้ใช้ปัจจุบัน");

        // ฟาร์มที่ catcher คนนี้รับผิดชอบ
        const { data: myFarms, error: eF } = await supabase
          .from("catching_farm_relations")
          .select("farm_id,status")
          .eq("catching_id", me.id)
          .eq("status", "active");
        if (eF) throw eF;

        const farmIds = Array.from(
          new Set((myFarms || []).map((x) => x.farm_id).filter(Boolean))
        );
        setHasFarmAccess(farmIds.length > 0);
        if (!farmIds.length) {
          setRows([]);
          setLastNoteByPlan({});
          setDocChecklistByPlan({});
          return;
        }

        // แผนคิวพื้นฐานจาก view v_plan_queue_simple (ไม่มี quantity)
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
              "delivery_time",
              "timetrucktofarm",
              "catch_time",
              "arrive_factory_time",
              "farm_id",
              "catch_plan_ts",
              "catch_plan_date",
              "arrived_farm_at", // เวลาใช้ร่วมกับรถ
              "last_team_count",
              "actual_start_at",
              "actual_end_at",
            ].join(", ")
          )
          .gte("delivery_date", start)
          .lte("delivery_date", end)
          .in("farm_id", farmIds)
          .order("delivery_date", { ascending: true })
          .order("plant", { ascending: true })
          .order("branch", { ascending: true })
          .order("house", { ascending: true });
        if (error) throw error;

        const baseRows = data || [];
        if (!baseRows.length) {
          setRows([]);
          setLastNoteByPlan({});
          setDocChecklistByPlan({});
          return;
        }

        // เอกสาร (album + ไฟล์)
        const farmList = Array.from(
          new Set(baseRows.map((r) => r.farm_id).filter(Boolean))
        );
        let albums = [];
        if (farmList.length) {
          const { data: _albums, error: eAlbums } = await supabase
            .from("plan_doc_albums")
            .select("id,farm_id,delivery_date,returned_for_fix")
            .in("farm_id", farmList)
            .gte("delivery_date", start)
            .lte("delivery_date", end);
          if (eAlbums) throw eAlbums;
          albums = _albums || [];
        }
        const key = (fid, d) => `${fid}|${d}`;
        const byKey = new Map(
          (albums || []).map((a) => [
            key(a.farm_id, new Date(a.delivery_date).toISOString().slice(0, 10)),
            a,
          ])
        );
        const albumIds = (albums || []).map((a) => a.id);

        const cntByAlbum = new Map();
        if (albumIds.length) {
          const { data: fs } = await supabase
            .from("plan_doc_files")
            .select("id,album_id")
            .in("album_id", albumIds);
          (fs || []).forEach((f) =>
            cntByAlbum.set(
              f.album_id,
              (cntByAlbum.get(f.album_id) || 0) + 1
            )
          );
        }

        let merged = baseRows.map((r) => {
          const a = byKey.get(key(r.farm_id, r.delivery_date));
          let ah_doc_status = "none";
          if (a) {
            const c = cntByAlbum.get(a.id) || 0;
            ah_doc_status = a.returned_for_fix
              ? "need_fix"
              : c > 0
              ? "ok"
              : "none";
          }
          return { ...r, ah_doc_status };
        });

        const planIds = merged.map((r) => r.plan_id);
        let checklistMap = {}; // *** NEW

        if (planIds.length) {
          // เวลาจาก catching_sessions + จำนวนสุกรจริง
          const { data: sess } = await supabase
            .from("catching_sessions")
            .select(
              "plan_id, arrived_farm_at, arrived_at, start_at, end_at, pig_count"
            )
            .in("plan_id", planIds);

          const best = (map, pid, ts) => {
            if (!ts) return;
            const prev = map.get(pid);
            if (!prev || new Date(ts) > new Date(prev)) map.set(pid, ts);
          };

          // ไม่ใช้ arrivedMap มาทับ arrived_farm_at จาก view
          const startMap = new Map();
          const endMap = new Map();
          const pigMap = new Map();

          (sess || []).forEach((s) => {
            best(startMap, s.plan_id, s.start_at);
            best(endMap, s.plan_id, s.end_at);
            if (s.pig_count != null) pigMap.set(s.plan_id, s.pig_count);
          });

          // จำนวนสุกรตามแผน จาก planning_plan_full_raw
          const qtyMap = new Map();
          try {
            const { data: planRows, error: ePlanInfo } = await supabase
              .from("planning_plan_full_raw")
              .select("id, quantity")
              .in("id", planIds);
            if (ePlanInfo) throw ePlanInfo;
            (planRows || []).forEach((p) => {
              qtyMap.set(p.id, p.quantity);
            });
          } catch (e) {
            console.log("loadQueues plan quantity error:", e.message);
          }

          // *** NEW: โหลด checklist จาก catching_doc_checklists
          try {
            const { data: ckRows, error: eCk } = await supabase
              .from("catching_doc_checklists")
              .select(
                [
                  "plan_id",
                  "r3",
                  "mthf",
                  "sps",
                  "lab_asf",
                  "lab_beta",
                  "lab_sulfa",
                  "farm_risk",
                  "no_red_meat",
                  "truck_inspect",
                  "truck_layout",
                ].join(", ")
              )
              .in("plan_id", planIds);
            if (eCk) throw eCk;

            (ckRows || []).forEach((c) => {
              checklistMap[c.plan_id] = {
                r3: !!c.r3,
                mthf: !!c.mthf,
                sps: !!c.sps,
                lab_asf: !!c.lab_asf,
                lab_beta: !!c.lab_beta,
                lab_sulfa: !!c.lab_sulfa,
                farm_risk: !!c.farm_risk,
                no_red_meat: !!c.no_red_meat,
                truck_inspect: !!c.truck_inspect,
                truck_layout: !!c.truck_layout,
              };
            });
          } catch (e) {
            console.log("loadQueues checklist error:", e.message);
          }

          merged = merged.map((r) => ({
            ...r,
            arrived_farm_at: r.arrived_farm_at || null,
            actual_start_at: r.actual_start_at || startMap.get(r.plan_id) || null,
            actual_end_at: r.actual_end_at || endMap.get(r.plan_id) || null,
            actual_pig_count: pigMap.get(r.plan_id) ?? null,
            plan_quantity: qtyMap.get(r.plan_id) ?? null,
          }));
        }

        // หมายเหตุล่าสุด
        let latestNote = {};
        if (planIds.length) {
          const { data: revs } = await supabase
            .from("catching_reviews")
            .select("plan_id,note,created_at")
            .in("plan_id", planIds)
            .order("created_at", { ascending: false });
          for (const r of revs || []) {
            if (!latestNote[r.plan_id] && r.note && String(r.note).trim()) {
              latestNote[r.plan_id] = r.note;
            }
          }
        }

        setLastNoteByPlan(latestNote);
        setDocChecklistByPlan(checklistMap); // *** NEW
        setRows(merged);
      } catch (e) {
        toastErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
    },
    [me?.id, start, end]
  );

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

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

  const saveTeamCount = async () => {
    toastOk("จดจำจำนวนทีมจับแล้ว (จะบันทึกจริงตอนเริ่ม/จบจับ)");
  };

  /* ถึงฟาร์ม (ใช้ session catching แต่เวลาแสดงใช้ field กลางร่วมกับรถ) */
  const arriveFarmNow = async (row) => {
    if (!me?.id) {
      toastErr("ไม่พบผู้ใช้ปัจจุบัน กรุณาเข้าสู่ระบบใหม่");
      return;
    }
    const plan_id = row.plan_id;
    const n = resolveTeamCount(row);
    setErr("");
    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from("catching_sessions").insert({
        plan_id,
        team_count: n,
        arrived_at: nowIso,
        arrived_farm_at: nowIso,
        created_by: me.id,
      });
      if (error) throw error;

      // ไม่ set arrived_farm_at ตรง ๆ ให้ไป sync จาก view (ร่วมกับรถ) ตอน reload
      toastOk("บันทึกเวลาถึงฟาร์มแล้ว");
      loadQueues();
    } catch (e) {
      toastErr(e.message || "บันทึกเวลาถึงฟาร์มไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  /* เริ่มจับ */
  const startCatching = async (row) => {
    if (!me?.id) {
      toastErr("ไม่พบผู้ใช้ปัจจุบัน กรุณาเข้าสู่ระบบใหม่");
      return;
    }
    if (!row.arrived_farm_at) {
      toastErr(
        "กรุณากด 'ถึงฟาร์ม' หรือให้รถบันทึกเวลาถึงฟาร์มก่อนเริ่มจับ"
      );
      return;
    }

    const plan_id = row.plan_id;
    const n = resolveTeamCount(row);
    setErr("");
    setBusy(true);
    try {
      const ts = new Date().toISOString();
      const { error } = await supabase.from("catching_sessions").insert({
        plan_id,
        team_count: n,
        start_at: ts,
        created_by: me.id,
      });
      if (error) throw error;
      setRows((prev) =>
        prev.map((x) =>
          x.plan_id === plan_id ? { ...x, actual_start_at: ts } : x
        )
      );
      toastOk("เริ่มจับแล้ว");
      loadQueues();
    } catch (e) {
      toastErr(e.message || "เริ่มจับไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  /* จบจับจริง */
  const endCatching = async (row) => {
    if (!me?.id) {
      toastErr("ไม่พบผู้ใช้ปัจจุบัน กรุณาเข้าสู่ระบบใหม่");
      return;
    }
    const plan_id = row.plan_id;
    const n = resolveTeamCount(row);
    const note = String(noteByPlan[plan_id] || "").trim() || null;

    // จำนวนสุกรจับจริง
    const rawPig = (
      pigByPlan[plan_id] ??
      row.actual_pig_count ??
      ""
    )
      .toString()
      .trim();
    const pig = rawPig ? Number(rawPig) : null;
    if (rawPig && (!Number.isFinite(pig) || pig < 0)) {
      toastErr("จำนวนสุกรจับจริงไม่ถูกต้อง");
      return;
    }

    setErr("");
    setBusy(true);
    try {
      const ts = new Date().toISOString();
      const payload = {
        plan_id,
        team_count: n,
        end_at: ts,
        created_by: me.id,
      };
      if (pig != null) payload.pig_count = pig;

      const { error } = await supabase
        .from("catching_sessions")
        .insert(payload);
      if (error) throw error;

      if (note) setLastNoteByPlan((p) => ({ ...p, [plan_id]: note }));
      setRows((prev) =>
        prev.map((x) =>
          x.plan_id === plan_id
            ? {
                ...x,
                actual_end_at: ts,
                actual_pig_count:
                  pig != null ? pig : x.actual_pig_count ?? null,
              }
            : x
        )
      );
      toastOk("บันทึกเวลาจบจับแล้ว");
      loadQueues();
    } catch (e) {
      toastErr(e.message || "จบจับไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  /* ปิดคิว */
  const closeQueue = async (row) => {
    if (!me?.id) {
      toastErr("ไม่พบผู้ใช้ปัจจุบัน กรุณาเข้าสู่ระบบใหม่");
      return;
    }
    const plan_id = row.plan_id;
    const note = String(noteByPlan[plan_id] || "").trim() || null;

    // === ชั้นตรวจสอบ: รวบรวมสิ่งที่ยัง "ขาด" อยู่ก่อนปิดคิว ===
    const missing = [];

    // 1) เอกสารจากระบบเดิม (อัลบั้มไฟล์)
    if (row.ah_doc_status !== "ok") {
      missing.push("ตรวจเอกสารในระบบ (AH Upload) ให้เรียบร้อย");
    }

    // 2) Checklist เอกสารประกอบ
    const checks = docChecklistByPlan[plan_id] || {};

    // 2.1 กลุ่มที่ต้องมีทุกคิว
    const missingRequiredKeys = ALWAYS_REQUIRED_KEYS.filter((k) => !checks[k]);
    if (missingRequiredKeys.length > 0) {
      const labels = DOC_CHECK_ITEMS.filter((it) =>
        missingRequiredKeys.includes(it.key)
      ).map((it) => it.label);
      missing.push(
        `Checklist เอกสารประกอบยังไม่ครบ: ${labels.join(", ")}`
      );
    }

    // 2.2 กลุ่ม lab
    const missingLabKeys = LAB_KEYS.filter((k) => !checks[k]);
    if (missingLabKeys.length > 0) {
      missing.push("ผล lab ยังไม่ครบ (ASF / เบต้า / ซัลฟา)");
    }

    // 2.3 ใบประเมินความเสี่ยงฟาร์ม — required เฉพาะกรณีข้ามเขต
    if (isCrossZone(row) && !checks.farm_risk) {
      missing.push(
        "ยังไม่ได้ติ๊กใบประเมินความเสี่ยงฟาร์ม (กรณีข้ามพื้นที่เขตปศุสัตว์)"
      );
    }

    // 2.4 ใบปลอดสารเร่งเนื้อแดง — required เฉพาะโรงงาน LRSS
    if (isLRSSFactory(row.factory) && !checks.no_red_meat) {
      missing.push("ยังไม่ได้ติ๊กใบปลอดสารเร่งเนื้อแดง (โรงงาน LRSS)");
    }

    // 3) เวลาถึงฟาร์ม (จากรถหรือ Catching, ใช้ field กลางร่วมกัน)
    if (!row.arrived_farm_at) {
      missing.push("บันทึกเวลาถึงฟาร์ม (จากรถหรือจาก Catching)");
    }

    // 4) เวลาเริ่มจับจริง
    if (!row.actual_start_at) {
      missing.push("บันทึกเวลาเริ่มจับจริง");
    }

    // 5) เวลาจบจับจริง
    if (!row.actual_end_at) {
      missing.push("บันทึกเวลาจบจับจริง");
    }

    // 6) จำนวนสุกรจับจริง
    if (row.actual_pig_count == null) {
      missing.push("บันทึกจำนวนสุกรจับจริง");
    }

    // ถ้ามีรายการที่ขาด ให้เตือนแล้วไม่ให้ปิดคิว
    if (missing.length > 0) {
      toastErr(`ยังขาดขั้นตอน: ${missing.join(" · ")}`);
      return;
    }

    // === ผ่านทุกเงื่อนไขแล้ว ค่อยบันทึกปิดคิว ===
    setErr("");
    setBusy(true);
    try {
      const { error } = await supabase.from("catching_reviews").insert({
        plan_id,
        status: "finished",
        note,
        checked_by: me.id,
      });
      if (error) throw error;

      setRows((prev) => prev.filter((x) => x.plan_id !== plan_id));
      toastOk("ปิดคิวสำเร็จ");
    } catch (e) {
      toastErr(e.message || "ปิดคิวไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async (plan_id) => {
    const note = String(noteByPlan[plan_id] || "").trim();
    if (!note) return;
    setLastNoteByPlan((p) => ({ ...p, [plan_id]: note }));
    toastOk("บันทึกหมายเหตุชั่วคราวแล้ว (จะส่งไปพร้อมตอนปิดคิว)");
  };

  /* ---------- Modal เอกสาร (ไฟล์จาก AH) ---------- */
  const openDocs = async (row) => {
    const { plan_id, farm_id, delivery_date } = row;
    setDocErr("");
    setDocBusy(true);
    setDocAlbum(null);
    setDocFiles([]);
    setDocPlanId(plan_id);
    setDocOpen(true);

    try {
      const { data: albums2, error: e2 } = await supabase
        .from("plan_doc_albums")
        .select("id,farm_id,delivery_date,returned_for_fix")
        .eq("farm_id", farm_id)
        .eq("delivery_date", delivery_date)
        .limit(1);
      if (e2) throw e2;

      const album = (albums2 && albums2[0]) || null;
      if (!album) {
        setDocAlbum(null);
        setDocFiles([]);
        return;
      }
      setDocAlbum(album);

      const { data: files, error: e3 } = await supabase
        .from("plan_doc_files")
        .select("id,file_name,file_url,note")
        .eq("album_id", album.id)
        .order("created_at", { ascending: true });
      if (e3) throw e3;

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
    setDocErr("");
    setDocPlanId(null);
  };

  const approveFile = async (fileId) => {
    if (!docAlbum?.id) return;
    setDocBusy(true);
    setDocErr("");
    try {
      const { error } = await supabase
        .from("plan_doc_files")
        .update({ note: "APPROVED" })
        .eq("id", fileId);
      if (error) throw error;
      setDocFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, note: "APPROVED" } : f))
      );
    } catch (e) {
      setDocErr(e.message || "อัปเดตสถานะไฟล์ไม่สำเร็จ");
    } finally {
      setDocBusy(false);
    }
  };

  const rejectFile = async (fileId) => {
    if (!docAlbum?.id) return;
    const reason = window.prompt("ระบุเหตุผลที่ไม่ผ่าน:", "");
    if (reason === null) return;
    const text = String(reason).trim();
    if (!text) return;
    setDocBusy(true);
    setDocErr("");
    try {
      const { error } = await supabase
        .from("plan_doc_files")
        .update({ note: `REJECT:${text}` })
        .eq("id", fileId);
      if (error) throw error;
      setDocFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, note: `REJECT:${text}` } : f
        )
      );
    } catch (e) {
      setDocErr(e.message || "อัปเดตสถานะไฟล์ไม่สำเร็จ");
    } finally {
      setDocBusy(false);
    }
  };

  /* ---------- Modal Checklist เอกสารประกอบ ---------- */
  const openChecklist = (plan_id) => {
    setCheckPlanId(plan_id);
    setCheckOpen(true);
  };

  const closeChecklist = () => {
    setCheckOpen(false);
    setCheckPlanId(null);
  };

  const toggleChecklistItem = (plan_id, key) => {
    setDocChecklistByPlan((prev) => {
      const current = prev[plan_id] || {};
      return {
        ...prev,
        [plan_id]: {
          ...current,
          [key]: !current[key],
        },
      };
    });
  };

  // *** NEW: บันทึก checklist ลง table catching_doc_checklists
  const saveChecklistToDB = async (plan_id) => {
    if (!plan_id) return;
    if (!me?.id) {
      toastErr("ไม่พบผู้ใช้ปัจจุบัน กรุณาเข้าสู่ระบบใหม่");
      return;
    }
    const checks = docChecklistByPlan[plan_id] || {};

    const payload = {
      plan_id,
      r3: !!checks.r3,
      mthf: !!checks.mthf,
      sps: !!checks.sps,
      lab_asf: !!checks.lab_asf,
      lab_beta: !!checks.lab_beta,
      lab_sulfa: !!checks.lab_sulfa,
      farm_risk: !!checks.farm_risk,
      no_red_meat: !!checks.no_red_meat,
      truck_inspect: !!checks.truck_inspect,
      truck_layout: !!checks.truck_layout,
      updated_by: me.id,
      updated_at: new Date().toISOString(),
    };

    setErr("");
    setBusy(true);
    try {
      const { error } = await supabase
        .from("catching_doc_checklists")
        // ต้องมี UNIQUE หรือ PRIMARY KEY ที่ column plan_id ตามที่อธิบายข้างบน
        .upsert(payload, { onConflict: "plan_id" });
      if (error) throw error;
      toastOk("บันทึก checklist เอกสารประกอบแล้ว");
      closeChecklist();
    } catch (e) {
      toastErr(e.message || "บันทึก checklist ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const doLogout = () => {
    try {
      localStorage.clear(); // เคลียร์ localStorage ทั้งหมด
    } catch {}
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="bg-amber-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Catching Desk</h1>
          <button
            type="button"
            onClick={doLogout}
            className="rounded-md bg-amber-300 text-amber-950 px-4 py-2 font-semibold hover:bg-amber-400 active:bg-amber-500"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 flex items-center justify-between">
            <span>{err}</span>
            <button
              className="text-red-700"
              onClick={() => setErr("")}
            >
              ×
            </button>
          </div>
        )}
        {ok && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
            {ok}
          </div>
        )}

        {/* Filters */}
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
              {query?.trim()
                ? "ไม่พบคิวตามเงื่อนไข"
                : hasFarmAccess === false
                ? "คุณยังไม่มีฟาร์มที่รับผิดชอบ หรือยังไม่ได้รับสิทธิ์เข้าถึงฟาร์ม"
                : "ช่วงวันที่นี้ยังไม่มีคิวสำหรับฟาร์มที่คุณรับผิดชอบ"}
            </div>
          )}

          {filtered.map((r) => {
            const plan_id = r.plan_id;
            const checklist = docChecklistByPlan[plan_id] || {};
            const allChecked =
              DOC_CHECK_ITEMS.length > 0 &&
              DOC_CHECK_ITEMS.every((item) => checklist[item.key]);

            return (
              <div
                key={plan_id}
                className="rounded-xl border border-amber-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {r.delivery_date} • {r.plant} / {r.branch} / {r.house} —{" "}
                    {r.farm_name || "-"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill color={DOC_COLOR[r.ah_doc_status] || "slate"}>
                      เอกสาร: {DOC_THAI[r.ah_doc_status] || "-"}
                    </Pill>
                    <Pill color={allChecked ? "green" : "amber"}>
                      Checklist เอกสารประกอบ:{" "}
                      {allChecked ? "ครบ" : "ยังไม่ครบ"}
                    </Pill>
                    <button
                      type="button"
                      onClick={() => openDocs(r)}
                      className="rounded-md px-3 py-1.5 text-sm border bg-amber-50 border-amber-300 hover:bg-amber-100"
                    >
                      ดูเอกสาร (ไฟล์)
                    </button>
                    <button
                      type="button"
                      onClick={() => openChecklist(plan_id)}
                      className="rounded-md px-3 py-1.5 text-sm border bg-emerald-50 border-emerald-300 hover:bg-emerald-100"
                    >
                      ตรวจเอกสารประกอบ
                    </button>
                  </div>
                </div>

                {/* เวลาสำคัญ + ปริมาณสุกร */}
                <div className="mt-2 text-sm text-gray-700">
                  โรงงาน: <b>{r.factory || "-"}</b>
                  <div className="text-xs text-gray-600 mt-1">
                    เวลาแผน: <b>{r.delivery_time ?? "-"}</b> · เวลาไปฟาร์ม:{" "}
                    <b>{r.timetrucktofarm ?? "-"}</b> · เวลาจับ:{" "}
                    <b>{r.catch_time ?? "-"}</b> · ถึงโรงงาน:{" "}
                    <b>{r.arrive_factory_time ?? "-"}</b>
                  </div>

                  <div className="text-xs text-gray-700 mt-1">
                    วันที่จับ(แผน): <b>{fmtD(r.catch_plan_ts)}</b> ·
                    เวลาจับ(แผน): <b>{fmtT(r.catch_plan_ts)}</b> · ถึงฟาร์มจริง
                    (ใช้ร่วมกับรถ): <b>{fmtDT(r.arrived_farm_at)}</b>
                  </div>
                  <div className="text-xs text-gray-700">
                    เริ่มจับจริง: <b>{fmtDT(r.actual_start_at)}</b>{" "}
                    {r.actual_start_at && r.catch_plan_ts
                      ? `(${diffPlan(
                          r.actual_start_at,
                          r.catch_plan_ts
                        )})`
                      : ""}
                    {" · "}จบจับจริง: <b>{fmtDT(r.actual_end_at)}</b>{" "}
                    {r.actual_end_at && r.catch_plan_ts
                      ? `(${diffPlan(r.actual_end_at, r.catch_plan_ts)})`
                      : ""}
                  </div>
                  {/* ปริมาณสุกรตามแผน + จับจริง */}
                  <div className="text-xs text-gray-700 mt-1">
                    จำนวนสุกรตามแผน:{" "}
                    <b>
                      {r.plan_quantity != null ? r.plan_quantity : "-"}
                    </b>{" "}
                    ตัว · จำนวนสุกรจับจริง:{" "}
                    <b>
                      {r.actual_pig_count != null
                        ? r.actual_pig_count
                        : "-"}
                    </b>{" "}
                    ตัว
                  </div>
                </div>

                {/* ทีมจับสุกร + ปุ่ม */}
                <div className="mt-3 rounded-lg border border-amber-200 p-3">
                  <div className="text-sm text-gray-600 mb-1">
                    ทีมจับสุกร
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={
                        teamByPlan[plan_id] ??
                        (r.last_team_count ?? "")
                      }
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "");
                        setTeamByPlan((p) => ({
                          ...p,
                          [plan_id]: v,
                        }));
                      }}
                      placeholder="จำนวนคน"
                      className="w-32 rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="text-xs text-gray-500">
                      ทีมล่าสุดจากระบบ: {r.last_team_count ?? "-"}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={saveTeamCount}
                      className="rounded-md border px-3 py-2 hover:bg-amber-50"
                    >
                      บันทึกจำนวนคน
                    </button>

                    {/* จำนวนสุกรจับจริง */}
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={
                        pigByPlan[plan_id] ??
                        (r.actual_pig_count ?? "")
                      }
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "");
                        setPigByPlan((p) => ({
                          ...p,
                          [plan_id]: v,
                        }));
                      }}
                      placeholder="จำนวนสุกรจับจริง"
                      className="w-40 rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
                    />

                    <button
                      type="button"
                      disabled={busy || !!r.arrived_farm_at}
                      title={r.arrived_farm_at ? "บันทึกแล้ว" : ""}
                      onClick={() => arriveFarmNow(r)}
                      className="rounded-md bg-sky-600 px-3 py-2 text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                      ถึงฟาร์ม
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startCatching(r)}
                      className="rounded-md bg-amber-600 px-3 py-2 text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      เริ่มจับ
                    </button>

                    <button
                      type="button"
                      disabled={busy || !!r.actual_end_at}
                      title={r.actual_end_at ? "บันทึกแล้ว" : ""}
                      onClick={() => endCatching(r)}
                      className="rounded-md bg-fuchsia-600 px-3 py-2 text-white hover:bg-fuchsia-700 disabled:opacity-60"
                    >
                      จบจับจริง
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      title=""
                      onClick={() => closeQueue(r)}
                      className="rounded-md bg-rose-600 px-3 py-2 text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      ปิดคิว
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ---------- Modal ดูเอกสาร (ไฟล์จาก AH) ---------- */}
      {docOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow border border-amber-200">
            <div className="px-4 py-3 bg-amber-100 border-b border-amber-200 rounded-t-xl flex items-center justify-between">
              <div className="font-semibold">เอกสารจาก Animal husbandry</div>
              <button
                onClick={closeDocs}
                className="rounded-md px-2 py-1 border border-amber-300 hover:bg-amber-200"
              >
                ปิด
              </button>
            </div>

            <div className="p-4 space-y-3">
              {docErr && (
                <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">
                  {docErr}
                </div>
              )}

              {docBusy ? (
                <div className="text-gray-500">กำลังโหลดเอกสาร…</div>
              ) : !docAlbum ? (
                <div className="text-gray-600">
                  ไม่พบอัลบั้มเอกสารสำหรับคิวนี้
                </div>
              ) : (
                <>
                  <div className="text-sm text-gray-700">
                    คิว: <b>{docPlanId}</b> · สถานะ:{" "}
                    {docAlbum.returned_for_fix ? (
                      <Pill color="red">ตีกลับ</Pill>
                    ) : (
                      <Pill color="green">เรียบร้อย</Pill>
                    )}
                  </div>

                  <div className="rounded border border-amber-200">
                    <div className="px-3 py-2 bg-amber-50 border-b">
                      ไฟล์เอกสาร
                    </div>
                    {docFiles.length ? (
                      <ul className="max-h-[28rem] overflow-auto divide-y">
                        {docFiles.map((f) => {
                          const meta = parseDocNote(f.note);
                          return (
                            <li
                              key={f.id}
                              className="px-3 py-2 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="font-medium truncate">
                                  {f.file_name}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  {meta.status === "approved" ? (
                                    <Pill color="green">เรียบร้อย</Pill>
                                  ) : meta.status === "rejected" ? (
                                    <>
                                      <Pill color="red">ตีกลับ</Pill>
                                      {meta.reason ? (
                                        <span className="text-xs text-rose-700">
                                          เหตุผล: {meta.reason}
                                        </span>
                                      ) : null}
                                    </>
                                  ) : (
                                    <Pill>รอดำเนินการ</Pill>
                                  )}
                                  {meta.ahNote ? (
                                    <span className="text-xs text-amber-700">
                                      หมายเหตุจาก AH:{" "}
                                      <b>{meta.ahNote}</b>
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex gap-2 shrink-0">
                                <a
                                  href={f.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-md border px-3 py-2 hover:bg-amber-50"
                                >
                                  เปิดไฟล์
                                </a>
                                <button
                                  type="button"
                                  onClick={() => approveFile(f.id)}
                                  disabled={docBusy}
                                  className="rounded-md bg-emerald-600 text-white px-3 py-2 hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  อนุมัติไฟล์
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectFile(f.id)}
                                  disabled={docBusy}
                                  className="rounded-md bg-rose-600 text-white px-3 py-2 hover:bg-rose-700 disabled:opacity-60"
                                >
                                  ไม่ผ่าน
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="px-3 py-6 text-center text-gray-500">
                        ยังไม่มีไฟล์
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Modal Checklist เอกสารประกอบการจับสุกรเข้าโรงงาน ---------- */}
      {checkOpen && checkPlanId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-full max-w-xl bg-white rounded-xl shadow border border-emerald-200">
            <div className="px-4 py-3 bg-emerald-100 border-b border-emerald-200 rounded-t-xl flex items-center justify-between">
              <div className="font-semibold">
                เอกสารประกอบการจับสุกรเข้าโรงงาน
              </div>
              <button
                onClick={closeChecklist}
                className="rounded-md px-2 py-1 border border-emerald-300 hover:bg-emerald-200 text-sm"
              >
                ปิด
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[28rem] overflow-auto">
              <div className="text-sm text-gray-700">
                กรุณาติ๊กเอกสารให้ครบทุกข้อ ก่อนปิดคิว
                (ใช้สำหรับยืนยันว่าเอกสารกระดาษครบถ้วน)
              </div>
              <div className="space-y-2">
                {DOC_CHECK_ITEMS.map((item) => {
                  const checked = !!(
                    docChecklistByPlan[checkPlanId]?.[item.key]
                  );
                  return (
                    <label
                      key={item.key}
                      className="flex items-start gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4"
                        checked={checked}
                        onChange={() =>
                          toggleChecklistItem(checkPlanId, item.key)
                        }
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeChecklist}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={() => saveChecklistToDB(checkPlanId)}
                  className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm hover:bg-emerald-700"
                >
                  บันทึก checklist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
