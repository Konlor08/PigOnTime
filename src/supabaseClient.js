import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// กันสร้างซ้ำเวลา HMR (dev) + ตั้ง storageKey เฉพาะแอป
const client =
  globalThis.__supabase__ ??
  createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: localStorage,
      storageKey: "pig-on-time-auth" // ตั้งชื่อไม่ซ้ำโปรเจกต์อื่น
    },
  });

if (import.meta.env.DEV) {
  globalThis.__supabase__ = client; // cache ไว้กันสร้างซ้ำ
}

export const supabase = client; // ใช้แบบ named export
