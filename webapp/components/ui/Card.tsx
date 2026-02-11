import { cn } from "@/lib/cn";

export default function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-vs-border bg-vs-surface/80 shadow-glow backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
