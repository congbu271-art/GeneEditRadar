"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: Route;
  label: string;
};

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-cyan-50 text-cyan-800 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.55)]"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
      )}
    >
      {label}
    </Link>
  );
}
