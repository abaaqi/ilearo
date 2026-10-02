import type { Metadata, Viewport } from "next";
import "@fontsource-variable/big-shoulders-stencil";
import "@fontsource-variable/commissioner/flar.css";
import "./globals.css";
import { AdireFilters } from "@/components/adire/art";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SHOP } from "@/lib/shop";

export const metadata: Metadata = {
  title: { default: `${SHOP.name}: hand-dyed adire`, template: `%s | ${SHOP.name}` },
  description: SHOP.description,
};

export const viewport: Viewport = {
  themeColor: "#141c45",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-pit focus:px-4 focus:py-2 focus:text-starch"
        >
          Skip to content
        </a>
        <AdireFilters />
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
