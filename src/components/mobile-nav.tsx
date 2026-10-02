"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useIsCurrent, type NavLink } from "./nav-links";

/** Menu button and drop-down for narrow screens. */
export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const params = useSearchParams();
  const isCurrent = useIsCurrent();
  const location = `${pathname}?${params.toString()}`;
  const [seenLocation, setSeenLocation] = useState(location);

  // Close after navigating somewhere new.
  if (location !== seenLocation) {
    setSeenLocation(location);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2 px-2 font-semibold text-pit"
      >
        <svg viewBox="0 0 20 14" className="h-3.5 w-5" aria-hidden="true">
          {open ? (
            <path d="M3 1l14 12M17 1L3 13" stroke="currentColor" strokeWidth="2" />
          ) : (
            <path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" strokeWidth="2" strokeDasharray="5 2.5" />
          )}
        </svg>
        Menu
      </button>
      <nav
        id={panelId}
        aria-label="Menu"
        hidden={!open}
        className="absolute inset-x-0 top-full z-40 border-b border-wash bg-resist shadow-[0_12px_24px_-12px_rgb(20_28_69_/_0.35)]"
      >
        <ul className="mx-auto max-w-[76rem] px-4 py-2 sm:px-6">
          {links.map((link) => (
            <li key={link.href} className="border-b border-wash last:border-b-0">
              <Link
                href={link.href}
                aria-current={isCurrent(link.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center text-lg text-pit no-underline aria-[current=page]:font-bold"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
