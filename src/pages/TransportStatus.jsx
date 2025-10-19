import { useNavigate } from "react-router-dom";

export default function TransportStatus() {
const navigate = useNavigate();
return (
<div className="min-h-screen bg-gray-100">
<header className="bg-yellow-500 text-white">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<h1 className="text-2xl font-semibold">สถานะการขนส่ง</h1>
<button onClick={()=>navigate("/planning")} className="bg-white/10 px-3 py-1.5 rounded-md text-sm hover:bg-white/20">Back</button>
</div>
</header>
<main className="mx-auto max-w-6xl px-4 py-6">หน้ากำลังพัฒนา</main>
</div>
);
}