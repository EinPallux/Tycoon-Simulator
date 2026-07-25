"use client";

type Tone = "accent" | "info" | "danger" | "good" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  accent: "bg-accent-500 text-ink-900",
  info: "bg-info-400 text-ink-900",
  danger: "bg-danger-500 text-paper-050",
  good: "bg-good-500 text-paper-050",
  neutral: "bg-ink-600 text-paper-050",
};

export function Badge({
  tone = "accent",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`skewed inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONE_CLASSES[tone]} ${className}`}
    >
      <span className="unskew inline-block">{children}</span>
    </span>
  );
}
