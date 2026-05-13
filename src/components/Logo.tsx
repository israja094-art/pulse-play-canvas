import { Zap } from "lucide-react";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  const box = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const icon = size === "lg" ? "h-5 w-5" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className="flex items-center gap-2">
      <div
        className={`${box} rounded-xl flex items-center justify-center`}
        style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-brand)" }}
      >
        <Zap className={`${icon} text-primary-foreground`} fill="currentColor" />
      </div>
      <span
        className={`${text} font-extrabold tracking-tight bg-clip-text text-transparent`}
        style={{ backgroundImage: "var(--gradient-brand)" }}
      >
        ZabPlay
      </span>
    </div>
  );
}
