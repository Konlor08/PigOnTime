// src/Nav.jsx
import { Link, useLocation } from "react-router-dom";

export default function Nav({ rightLinks }) {
const { pathname } = useLocation();

// Fallback: ถ้าไม่ส่ง rightLinks มา ให้มี Login / Register / Reset ครบ
const links =
Array.isArray(rightLinks) && rightLinks.length > 0
? rightLinks
: [
{ to: "/login", label: "Login" },
{ to: "/register", label: "Register" },
{ to: "/resetpassword",label: "Reset" },
];

const linkBase = "text-[15px] px-3 py-2 rounded-md hover:underline";
const active = "font-semibold text-blue-600";
const normal = "text-gray-600";

return (
<header className="w-full border-b bg-white/70 backdrop-blur">
<div className="mx-auto max-w-screen-lg flex items-center justify-between px-2 sm:px-4 h-14">
{/* โลโก้ (ลิงก์ซ้าย) */}
<Link to="/login" className="flex items-center gap-2">
<img src="/logo.png" alt="Pig On Time" className="h-7 w-7" />
<span className="sr-only">Pig On Time</span>
</Link>

{/* เมนูขวา */}
<nav className="flex items-center gap-1">
{links.map(({ to, label }) => (
<Link
key={to}
to={to}
className={`${linkBase} ${pathname === to ? active : normal}`}
>
{label}
</Link>
))}
</nav>
</div>
</header>
);
}
