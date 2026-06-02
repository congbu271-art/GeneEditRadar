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
        "rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
