import { ReactNode } from "react";
import Navigation from "../Navigation";

interface LayoutProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";
  showNav?: boolean;
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  full: "max-w-full",
};

export default function Layout({
  children,
  className = "",
  maxWidth = "2xl",
  showNav = true,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-surface">
      {showNav && <Navigation />}
      <main className={`p-4 sm:p-6 ${className}`}>
        <div className={`mx-auto ${maxWidthClasses[maxWidth]}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
