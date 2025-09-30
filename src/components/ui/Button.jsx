export default function Button({ className = "", disabled, children, ...rest }) {
  return (
    <button
      disabled={disabled}
      className={`rounded bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
