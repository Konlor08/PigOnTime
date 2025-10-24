// src/pages/UploadPlanning.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import supabase from "../supabaseClient";

/* ======================== CONFIG / MAPPING ======================== */
const normHead = (k) =>
  String(k ?? "").replace(/\u00A0/g, " ").trim().replace(/\s+/g, " ");

const isJunkHeader = (h) => {
  const lower = String(h ?? "").trim().toLowerCase();
  return (
    lower === "" ||
    lower === "__empty" ||
    lower.startsWith("_empty") ||
    lower.startsWith("#value") ||
    lower === "-" ||
    lower.startsWith("_")
  );
};

/** Excel Header (TH) -> DB field */
const STD_MAP = {
  ลำดับ: "index_no",
  วันที่ส่งถึง: "delivery_date",
  เวลาถึงโรงงาน: "delivery_time",
  เวลาส่งถึง: "timetrucktofarm",
  Plant: "plant",
  House: "house",
  สาขา: "branch",

  // ฟาร์ม (หลายแบบ)
  "ฟาร์ม (โรงเรือน)": "farm_name",
  "ฟาร์ม โรงเรือน": "farm_name",
  ฟาร์ม: "farm_name",
  โรงเรือน: "farm_name",

  ตำบล: "subdistrict",
  อำเภอ: "district",
  จังหวัด: "province",

  จำนวนตัว: "quantity",
  ทะเบียนรถ: "plate",

  // day-fraction/raw
  อดอาหาร: "อดอาหาร_raw",
  นัดรถ: "นัดรถ", // เป็น date จริง อย่าตัดเวลาในฝั่งนี้
  วันที่จับ: "วันที่จับ_raw",
  เวลาจับ: "เวลาจับ_raw",
  ออกฟาร์ม: "ออกฟาร์ม_raw",

  ระยะทาง: "ระยะทาง",
  "ไป-กลับ": "ไป-กลับ",
  ความเร็ว: "ความเร็ว",
  "เวลาขนส่ง (น.)ฐาน 100": "เวลาขนส่ง_(น.)ฐาน_100",
  "เวลาขนส่ง (ชม.)": "เวลาขนส่ง_(ชม.)",
  เอกสาร: "เอกสาร",
  ราดน้ำ: "ราดน้ำ",

  "เวลาจับ (h:mm)": "เวลาจับ_(h:mm)",
  "เวลาถึง รง.(h:mm)": "เวลาถึง_รง.(h:mm)",

  หมายเหตุ: "remark",
  สุกรท้ายเล้า: "culled_swine",
  โรงงาน: "factory",

  // SITE
  SITE: "SITE",
  site: "SITE",
};

/** ฟิลด์ที่อนุญาต (ต้องตรงกับ DB) */
const ALLOWED_COLS = new Set([
  "pk",
  "file_name",
  "file_id",
  "SITE",
  "index_no",
  "delivery_date",
  "delivery_time",
  "timetrucktofarm",
  "plant",
  "house",
  "branch",
  "farm_name",
  "subdistrict",
  "district",
  "province",
  "quantity",
  "plate",

  "นัดรถ",

  "อดอาหาร_raw",
  "วันที่จับ_raw",
  "เวลาจับ_raw",
  "ออกฟาร์ม_raw",

  "ระยะทาง",
  "ไป-กลับ",
  "ความเร็ว",
  "เวลาขนส่ง_(น.)ฐาน_100",
  "เวลาขนส่ง_(ชม.)",
  "เอกสาร",
  "ราดน้ำ",

  "เวลาจับ_(h:mm)",
  "เวลาถึง_รง.(h:mm)",

  "remark",
  "culled_swine",
  "factory",
]);

/** ฟิลด์ชนิด DATE (ตัดเหลือเฉพาะ delivery_date) */
const DATE_FIELDS = new Set(["delivery_date"]);

/** ฟิลด์ชนิด TIME (HH:mm) */
const TIME_FIELDS = new Set([
  "delivery_time",
  "timetrucktofarm",
  "เวลาจับ_(h:mm)",
  "เวลาถึง_รง.(h:mm)",
]);

/* ======================== PARSERS ======================== */
const toDateStr = (v) => {
  if (v == null || v === "" || String(v).startsWith("#")) return null;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
};

const toTimeStr = (v) => {
  if (v == null || v === "" || String(v).startsWith("#")) return null;

  if (typeof v === "number") {
    const n = v;
    const frac = n % 1;
    const dayFraction = frac > 0 ? frac : n <= 1 ? n : 0;
    const totalMin = Math.round(dayFraction * 24 * 60);
    const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
    const mm = String(totalMin % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const s = String(v).trim();
  let m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m)
    return `${String(+m[1]).padStart(2, "0")}:${String(+m[2]).padStart(
      2,
      "0"
    )}`;

  m = s.match(/^(\d{1,2})(\d{2})$/);
  if (m)
    return `${String(+m[1]).padStart(2, "0")}:${String(+m[2]).padStart(
      2,
      "0"
    )}`;

  return null;
};

const toBool = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (["1", "t", "true", "y", "yes", "ใช่"].includes(s)) return true;
  if (["0", "f", "false", "n", "no", "ไม่"].includes(s)) return false;
  return null;
};

function buildPk(r) {
  // ถ้ามีลำดับ ให้ใส่วันที่พ่วงไปด้วย กันชนข้ามวัน
  if (r.index_no != null && r.index_no !== "") {
    return `IDX|${r.index_no}|${r.delivery_date ?? ""}`;
  }

  // pk แบบ 4 คีย์: วันที่ + ฟาร์ม + ทะเบียนรถ + เวลาถึงโรงงาน
  return [
    r.delivery_date ?? "",
    r.farm_name ?? "",
    r.plate ?? "",
    r.delivery_time ?? "",
  ]
    .map((x) => String(x).trim().toLowerCase())
    .join("|");
}

/* ======================== COMPONENT ======================== */
export default function UploadPlanning() {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [prepRows, setPrepRows] = useState([]);
  const [extraCols, setExtraCols] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  const handleFileChange = (e) => {
    setErr("");
    pickFile(e);
  };

  async function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setMsg("");

    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
        blankrows: false,
      });

      if (!raw.length) {
        setErr("ไม่พบข้อมูลในไฟล์");
        return;
      }

      const header = (raw[0] || [])
        .map(normHead)
        .filter((h) => !isJunkHeader(h));
      const rows = raw.slice(1);

      const headerMap = header.map((h) => ({
        original: h,
        to: STD_MAP[h] || null,
      }));

      const unknown = headerMap
        .filter((x) => !x.to || !ALLOWED_COLS.has(x.to))
        .map((x) => x.original);
      setExtraCols(unknown);

      if (unknown.length) {
        setPrepRows([]);
        setErr(
          `พบคอลัมน์ที่ไม่อยู่ในฐานข้อมูล: ${unknown.join(
            ", "
          )} · กรุณาปรับหัวคอลัมน์ให้ตรงกับ DB`
        );
        return;
      }

      const prepared = rows
        .filter((r) => r.some((v) => String(v).trim() !== ""))
        .map((r) => {
          const obj = {};
          headerMap.forEach(({ to }, i) => {
            if (!to) return;

            let v = r[i];

            if (DATE_FIELDS.has(to)) v = toDateStr(v);
            if (TIME_FIELDS.has(to)) v = toTimeStr(v);
            if (to === "quantity") {
              const n = Number(v);
              v = isNaN(n) ? null : n;
            }
            if (to === "culled_swine") v = toBool(v);

            obj[to] = v ?? null;
          });

          obj.file_name = f.name;
          obj.pk = buildPk(obj);
          return obj;
        });

      setPrepRows(prepared);
      setErr("");
    } catch (e1) {
      console.error(e1);
      setErr("อ่านไฟล์ไม่สำเร็จ หรือรูปแบบไม่ถูกต้อง");
    }
  }

  const clearPreview = () => {
    setFile(null);
    setPrepRows([]);
    setExtraCols([]);
    setMsg("");
    setErr("");
  };

  const deleteRow = (idx) => {
    setPrepRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCellChange = (rowIndex, colKey, value) => {
    setPrepRows((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };

      let v = value;
      if (DATE_FIELDS.has(colKey)) v = toDateStr(value);
      if (TIME_FIELDS.has(colKey)) v = toTimeStr(value);
      if (colKey === "quantity") {
        const n = Number(value);
        v = value === "" ? null : isNaN(n) ? value : n;
      }
      if (colKey === "culled_swine") v = toBool(value);

      row[colKey] = v;

      if (
        [
          "index_no",
          "factory",
          "delivery_date",
          "delivery_time",
          "plant",
          "house",
          "branch",
          "farm_name",
          "plate",
        ].includes(colKey)
      ) {
        row.pk = buildPk(row);
      }

      next[rowIndex] = row;
      return next;
    });
  };

  async function doUpload() {
    if (!prepRows.length) {
      setErr("ยังไม่มีข้อมูลสำหรับอัปโหลด");
      return;
    }
    if (extraCols.length) {
      setErr("ยังมีคอลัมน์ที่ไม่อยู่ใน DB · กรุณาแก้ Excel ให้ตรงก่อน");
      return;
    }

    if (!window.confirm(`ยืนยันนำเข้าข้อมูลทั้งหมด ${prepRows.length} แถว?`))
      return;

    setLoading(true);
    setMsg("");

    try {
      // -------- แทรกเฉพาะที่จำเป็น: ลบข้อมูลเก่าที่ pk ซ้ำก่อน insert --------
      const pks = [...new Set(prepRows.map((r) => r.pk).filter(Boolean))];
      if (pks.length) {
        // ลบเฉพาะชุด pk ที่กำลังอัปโหลด ออกจากตาราง raw
        await supabase.from("planning_plan_full_raw").delete().in("pk", pks);
      }
      // ----------------------------------------------------------------------

      // อัปขึ้น view อัปโหลด (trigger จะจัดการ insert → raw/normalize ให้เอง)
      const { error } = await supabase
        .from("planning_plan_full_upload")
        .insert(prepRows);
      if (error) throw error;

      setMsg(`นำเข้าข้อมูลสำเร็จ ${prepRows.length} แถว`);
    } catch (e2) {
      console.error(e2);
      setErr(`อัปโหลดไม่สำเร็จ: ${e2.message}`);
    } finally {
      setLoading(false);
    }
  }

  const columns = useMemo(() => {
    const set = new Set();
    prepRows.forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
    const order = Array.from(set).filter(
      (c) => !["pk", "file_name", "file_id"].includes(c)
    );
    return order.concat(["pk", "file_name", "created_at"]);
  }, [prepRows]);

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="bg-amber-500 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">อัปโหลดแผน (พรีวิว → นำเข้า)</h1>
          <button
            onClick={() => navigate("/planning")}
            className="rounded-md bg-white/20 px-4 py-1 text-sm hover:bg-white/30"
          >
            กลับหน้าแดชบอร์ด
          </button>
        </div>
      </header>

      {/* Alerts & Controls */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {msg && (
          <div className="mb-4 bg-green-100 text-green-700 px-4 py-2 rounded flex justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg("")}>×</button>
          </div>
        )}
        {err && (
          <div className="mb-4 bg-red-100 text-red-700 px-4 py-2 rounded flex justify-between">
            <span>{err}</span>
            <button onClick={() => setErr("")}>×</button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">เลือกไฟล์</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="block w-full text-sm"
              />
              {file && (
                <p className="text-xs text-gray-600 mt-1">
                  ไฟล์: <b>{file.name}</b>
                </p>
              )}
              {extraCols.length > 0 && (
                <p className="text-sm text-amber-700 mt-2">
                  ⚠️ พบคอลัมน์ที่ไม่อยู่ใน DB: <b>{extraCols.join(", ")}</b>
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={clearPreview}
                className="px-4 py-2 rounded-md border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
                disabled={loading}
              >
                ล้างพรีวิว
              </button>
              <button
                onClick={doUpload}
                className="px-4 py-2 rounded-md text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60"
                disabled={loading || prepRows.length === 0}
              >
                {loading ? "กำลังนำเข้า..." : "นำเข้าข้อมูล"}
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl border border-amber-200">
          <div className="px-4 py-2 bg-amber-100 border-b">
            <b>พรีวิวข้อมูล</b> ({prepRows.length} แถว)
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm whitespace-nowrap">
              <thead className="bg-amber-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  {columns.map((c) => (
                    <th key={c} className="px-3 py-2 text-left">
                      {c}
                    </th>
                  ))}
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {prepRows.length ? (
                  prepRows.map((r, i) => (
                    <tr key={i} className="border-b hover:bg-amber-50">
                      <td className="px-3 py-2">{i + 1}</td>
                      {columns.map((c) => (
                        <td key={c} className="px-3 py-2">
                          {["pk", "file_name"].includes(c) ? (
                            <span className="text-gray-500">{r[c] ?? ""}</span>
                          ) : (
                            <input
                              className="border rounded px-2 py-1 w-44"
                              value={r[c] ?? ""}
                              onChange={(e) =>
                                handleCellChange(i, c, e.target.value)
                              }
                              placeholder={c}
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <button
                          onClick={() => deleteRow(i)}
                          className="text-red-600 hover:underline"
                        >
                          ลบแถว
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length + 2}
                      className="px-3 py-4 text-gray-500"
                    >
                      ยังไม่มีข้อมูลพรีวิว
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
