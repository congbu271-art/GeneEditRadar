"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: Route;
  label: string;
  className?: string;
};

export function NavLink({ href, label, className }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex-1 text-sm font-semibold transition-all",
        active
          ? "text-cyan-700"
          : "text-slate-500 hover:text-slate-900",
        className
      )}
    >
      {label}
    </Link>
  );
}
