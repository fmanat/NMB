import type { ReactNode } from "react";

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "neutral" | "blue" | "success" | "warning"; className?: string }) {
  const t = tone === "neutral" ? "" : `badge-${tone}`;
  return <span className={`badge ${t} ${className}`.trim()}>{children}</span>;
}
