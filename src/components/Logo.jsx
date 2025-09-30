export default function Logo({ size = 28 }) {
  return (
    <div className="flex items-center gap-2">
      {/* ถ้าเป็น .svg ให้เปลี่ยน src เป็น /logo.svg */}
      <img src="/logo.png" alt="Pig On Time" width={size} height={size} className="rounded-sm" />
      <span className="font-bold">Pig On Time</span>
    </div>
  );
}