// src/components/CardLink.jsx
import { Link } from "react-router-dom";

export default function CardLink({ to, title, desc, icon: Icon }) {
return (
<Link
to={to}
className="group block rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
>
<div className="flex items-start justify-between">
<h3 className="text-xl font-bold text-blue-700 group-hover:text-blue-800">
{title}
</h3>
{Icon ? (
<Icon
className="h-5 w-5 text-gray-300 group-hover:text-gray-400"
aria-hidden="true"
/>
) : null}
</div>
{desc ? <p className="mt-2 text-gray-600">{desc}</p> : null}
</Link>
);
}
