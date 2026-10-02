"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type NavLink = { href: string; label: string };

/** True when the link points at the page (and filter) being viewed. */
export function useIsCurrent() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (href: string) => {
    const url = new URL(href, "http://x");
    if (url.pathname !== pathname) return false;
    if (pathname !== "/shop") return true;
    return (url.searchParams.get("category") ?? "") === (params.get("category") ?? "") && !params.get("technique");
  };
}

export function NavLinks({ links, className = "" }: { links: NavLink[]; className?: string }) {
  const isCurrent = useIsCurrent();
  return (
    <nav aria-label="Shop" className={className}>
      <ul className="flex items-center gap-x-6">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={isCurrent(link.href) ? "page" : undefined}
              className="py-2 text-pit no-underline decoration-2 underline-offset-[0.4em] hover:underline aria-[current=page]:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
