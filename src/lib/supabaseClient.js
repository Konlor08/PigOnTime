// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ส่งออกได้ทั้งแบบ named และ default เพื่อกัน error ทุกแบบ
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
