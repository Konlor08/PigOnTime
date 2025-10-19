// src/supabaseClient.js
// ──────────────────────────────────────────────────────────────
// สร้าง Supabase client เพียงครั้งเดียวทั้งแอป (singleton)
// ใช้กับ Vite: ต้องตั้งค่า ENV ชื่อ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY
// ──────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
// ช่วยระบุปัญหา env หายตั้งแต่ตอน build/dev
// (ไม่โยน error runtime ใน UI)

console.warn(
'[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY'
);
}

// ป้องกันการสร้าง client ซ้ำเมื่อ HMR ของ Vite รีโหลดโมดูล
// ใช้ globalThis เก็บ instance เดิมไว้
const globalKey = '__SUPABASE_SINGLETON__';

const supabase =
globalThis[globalKey] ||
createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
auth: {
persistSession: true,
autoRefreshToken: true,
detectSessionInUrl: true
}
});

// เก็บ instance ไว้ใน global เพื่อใช้ซ้ำ
globalThis[globalKey] = supabase;

export default supabase;
export { supabase };
