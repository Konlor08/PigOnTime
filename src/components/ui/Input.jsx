export default function Input({ label, hint, className = "", ...rest }) {
  return (
    <label className="block">
      {label && <span className="block text-sm mb-1">{label}</span>}
      <input
        className={`w-full rounded border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500 ${className}`}
        {...rest}
      />
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </label>
  );
}
