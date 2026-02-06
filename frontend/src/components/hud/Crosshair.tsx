export function Crosshair() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-1 h-1 bg-white/70 rounded-full" />
    </div>
  );
}
