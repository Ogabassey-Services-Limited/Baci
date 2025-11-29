import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "default" | "light";
}

export function Logo({ className, variant = "default" }: LogoProps) {
  const textColor = variant === "light" ? "text-white" : "text-primary";

  return (
    <div className={cn("flex items-center gap-2 font-bold text-2xl tracking-tight", className)}>
      <span className={textColor}>Bac</span>
      <div className="relative flex flex-col justify-end h-full">
        <span className={textColor}>i</span>
        <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent" />
      </div>
    </div>
  );
}
