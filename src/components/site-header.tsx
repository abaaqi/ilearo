import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { getCart } from "@/lib/cart";
import { CATEGORIES } from "@/lib/catalog";
import { LogoMark } from "./logo-mark";
import { NavLinks, type NavLink } from "./nav-links";
import { MobileNav } from "./mobile-nav";

const LINKS: NavLink[] = [
  { href: "/shop", label: "Shop all" },
  ...Object.entries(CATEGORIES).map(([key, category]) => ({ href: `/shop?category=${key}`, label: category.label })),
];

export async function SiteHeader() {
  const [user, cart] = await Promise.all([getCurrentUser(), getCart()]);
  const account = user ? { href: "/account", label: "Your account" } : { href: "/signin", label: "Sign in" };

  return (
    <header className="relative border-b border-wash bg-resist">
      <div className="mx-auto flex max-w-[76rem] items-center gap-x-10 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-pit no-underline">
          <LogoMark className="size-8" />
          <span className="font-stencil text-[1.85rem] tracking-[0.05em]">Ile Aro</span>
        </Link>

        <Suspense fallback={null}>
          <NavLinks links={LINKS} className="hidden lg:flex" />
        </Suspense>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <Link
            href="/cart"
            aria-label={`Cart, ${cart.itemCount} ${cart.itemCount === 1 ? "item" : "items"}`}
            className="flex min-h-11 items-center gap-2 px-2 font-semibold text-pit no-underline hover:underline"
          >
            Cart
            <span
              aria-hidden="true"
              className={`tabular grid min-w-7 place-items-center rounded-full px-1.5 text-sm leading-7 ${
                cart.itemCount > 0 ? "bg-pit text-starch" : "border border-line text-faded"
              }`}
            >
              {cart.itemCount}
            </span>
          </Link>
          <span className="hidden lg:block">
            <AccountLink user={user} />
          </span>
          <Suspense fallback={null}>
            <MobileNav links={[...LINKS, account]} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

function AccountLink({ user }: { user: SessionUser | null }) {
  if (!user) {
    return (
      <Link href="/signin" className="flex min-h-11 items-center px-2 font-semibold text-pit no-underline hover:underline">
        Sign in
      </Link>
    );
  }
  const initial = (user.name ?? user.email).trim().charAt(0).toUpperCase();
  return (
    <Link href="/account" className="flex min-h-11 items-center gap-2 px-2 font-semibold text-pit no-underline hover:underline">
      {user.avatarUrl ? (
        // Google profile photos are external; next/image would need their host allow-listed.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" width={28} height={28} referrerPolicy="no-referrer" className="size-7 rounded-full" />
      ) : (
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-pit text-sm text-starch">
          {initial}
        </span>
      )}
      Your account
    </Link>
  );
}
