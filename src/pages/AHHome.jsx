import { Link } from "react-router-dom";

export default function AHHome() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="flex items-center gap-3 mb-6">
        <img src="/logo.png" className="w-8 h-8" />
        <h1 className="text-2xl font-extrabold">Pig On Time — AH</h1>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-white rounded-xl border p-4">
          <h2 className="font-bold mb-2">งานที่ทำ</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><Link className="text-indigo-600" to="#">ผูกฟาร์มของฉัน (Add Farm Relation)</Link></li>
            <li><Link className="text-indigo-600" to="#">ฟาร์มของฉัน (ดู/ยกเลิกความสัมพันธ์)</Link></li>
          </ul>
        </section>

        <section className="bg-white rounded-xl border p-4">
          <h2 className="font-bold mb-2">กิจกรรมที่ต้องทำ</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="text-gray-500">เอกสารฟาร์มครบถ้วนหรือไม่</span></li>
            <li><span className="text-gray-500">ตรวจเส้นทาง/อากาศ</span></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
