// src/lib/supabaseClient.js
// อย่าสร้าง client ใหม่! แค่ re-export จากตัวหลัก
export { default as supabase } from '../supabaseClient';
export { supabase as default } from '../supabaseClient';