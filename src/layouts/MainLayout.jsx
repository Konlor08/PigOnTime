import { Link } from "react-router-dom";

export default function MainLayout({ children }) {
  const user = (() => { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }})();
  function logout() { localStorage.removeItem("user"); location.href = "/login"; }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold">Pig On Time</Link>
          <div className="text-sm">
            {user?.role && <span className="mr-3">Role: <b>{user.role}</b></span>}
            <button onClick={logout} className="text-blue-600">Logout</button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">{children}</main>
    </div>
  );
}
