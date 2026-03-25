import { ReactNode } from "react";

type BadgeVariant = "brand" | "success" | "danger" | "warning" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  brand: "badge-brand",
  success: "badge-success",
  danger: "badge-danger",
  warning: "badge-warning",
  neutral: "badge-neutral",
};

export default function Badge({ variant = "brand", children, className = "" }: BadgeProps) {
  return <span className={`${variantClasses[variant]} ${className}`}>{children}</span>;
}
