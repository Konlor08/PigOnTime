// src/components/Header.jsx
import { Link, NavLink } from "react-router-dom";
import AppLogo from "./AppLogo";
export default function Header() {
  return (
    <header className="w-full border-b bg-white">
      <div className="mx-auto max-w-4xl px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <AppLogo />
          <span className="font-semibold">Pig On Time</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/login" className="hover:underline">Login</NavLink>
          <NavLink to="/register" className="hover:underline">Register</NavLink>
          <NavLink to="/reset" className="hover:underline">Reset</NavLink>
        </nav>
      </div>
    </header>
  );
}
