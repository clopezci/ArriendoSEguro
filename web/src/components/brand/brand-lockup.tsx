import { appConfig } from "@/lib/config";

export function BrandLockup({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden="true"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-violet-400/40 bg-gradient-to-br from-violet-500/30 via-violet-600/20 to-slate-900 text-[10px] font-extrabold tracking-[0.08em] text-violet-100 shadow-[0_0_14px_rgba(139,92,246,0.35)]"
      >
        AS
      </span>
      {!compact && <span>{appConfig.name}</span>}
    </span>
  );
}

