export default function FormCard({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="bg-white shadow rounded-lg p-5 md:p-6">
        {title && <div className="text-lg font-semibold mb-1">{title}</div>}
        {subtitle && <p className="text-xs text-gray-500 mb-4">{subtitle}</p>}
        {children}
        {footer && <div className="mt-4 text-xs text-center">{footer}</div>}
      </div>
    </div>
  );
}
