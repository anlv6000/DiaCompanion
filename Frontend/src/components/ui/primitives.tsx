import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// One primary action per view; everything else is quiet (ghost / hairline).
type BtnVariant = "primary" | "ghost" | "outline" | "danger";
export function Button({
  variant = "outline",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const base =
    "inline-flex items-center gap-2 h-8 px-3 rounded-sm text-dense font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const styles: Record<BtnVariant, string> = {
    primary: "bg-primary text-white hover:bg-primary-active",
    ghost: "text-ink-muted hover:bg-canvas",
    outline: "border border-hairline text-ink hover:bg-canvas",
    danger: "border border-risk-alert text-risk-alert hover:bg-canvas",
  };
  return (
    <button className={cx(base, styles[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("bg-surface border border-hairline rounded-md", className)}>{children}</div>
  );
}

export function PanelHeader({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 h-11 border-b border-hairline">
      <h2 className="text-sub font-serif text-ink">{title}</h2>
      {right}
    </div>
  );
}

type BadgeTone = "neutral" | "defer" | "ok" | "watch" | "alert" | "primary";
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-canvas text-ink-muted border-hairline",
    defer: "bg-defer-bg text-defer border-defer/30",
    ok: "text-risk-ok border-risk-ok/30 bg-risk-ok/5",
    watch: "text-risk-watch border-risk-watch/30 bg-risk-watch/5",
    alert: "text-risk-alert border-risk-alert/30 bg-risk-alert/5",
    primary: "text-primary border-primary/30 bg-primary/5",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 h-5 px-1.5 rounded-xs border text-micro font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse bg-hairline/70 rounded-sm", className)} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-meta text-ink-faint mb-1">{label}</span>
      {children}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full h-8 px-2.5 rounded-sm border border-hairline bg-surface text-dense text-ink placeholder:text-ink-faint",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "w-full h-8 px-2 rounded-sm border border-hairline bg-surface text-dense text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { cx };
