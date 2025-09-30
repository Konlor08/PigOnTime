export default function Select({ label, children, className = "", ...rest }) {
  return (
    <label className="block">
      {label && <span className="block text-sm mb-1">{label}</span>}
      <select
        className={`w-full rounded border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500 ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}
