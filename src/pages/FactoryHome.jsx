export default function FactoryHome() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="flex items-center gap-3 mb-6">
        <img src="/logo.png" className="w-8 h-8" />
        <h1 className="text-2xl font-extrabold">Pig On Time — Factory</h1>
      </header>

      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-bold mb-2">ข้อมูลที่เกี่ยวข้อง</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="text-gray-500">งานขาเข้า (เฉพาะฟาร์มที่เชื่อมโยง)</span></li>
        </ul>
      </div>
    </div>
  );
}
