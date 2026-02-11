import { cn } from "@/lib/cn";

export default function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-vs-border bg-vs-surface-2/70 px-4 text-sm text-white placeholder:text-white/35 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] outline-none focus:border-vs-cyan/60 focus:ring-2 focus:ring-vs-cyan/20",
        className,
      )}
      {...props}
    />
  );
}
