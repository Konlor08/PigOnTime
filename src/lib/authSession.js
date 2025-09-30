// src/lib/authSession.js
const KEY = "pigo.session";

export function saveSession(profile) {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
    })
  );
}
export function getSession() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { localStorage.removeItem(KEY); return null; }
}
export function clearSession() { localStorage.removeItem(KEY); }
export function isLoggedIn() { return !!getSession(); }
