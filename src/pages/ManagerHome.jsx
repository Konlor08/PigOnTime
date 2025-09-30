export default function ManagerHome() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="flex items-center gap-3 mb-6">
        <img src="/logo.png" className="w-8 h-8" />
        <h1 className="text-2xl font-extrabold">Pig On Time — Manager</h1>
      </header>

      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-bold mb-2">แดชบอร์ดรวม</h2>
        <p className="text-gray-600">ดูสถานะทุกกิจกรรม (read-only)</p>
      </div>
    </div>
  );
}
