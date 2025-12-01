import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  variant?: "default" | "light" | "auto";
}

export function Logo({ className, width = 100, height = 31, variant = "auto" }: LogoProps) {
  if (variant === "light") {
    return (
      <div className={cn("relative", className)} style={{ width, height }}>
        <Image
          src="/baci-logo-dark.svg"
          alt="Baci Logo"
          fill
          className="object-contain"
          priority
        />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} style={{ width, height }}>
      <Image
        src="/baci-logo.svg"
        alt="Baci Logo"
        fill
        className="object-contain dark:hidden"
        priority
      />
      <Image
        src="/baci-logo-dark.svg"
        alt="Baci Logo"
        fill
        className="object-contain hidden dark:block"
        priority
      />
    </div>
  );
}
