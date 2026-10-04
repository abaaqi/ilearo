"use client";

import "@fontsource-variable/big-shoulders-stencil";
import "@fontsource-variable/commissioner/flar.css";
import "./globals.css";
import { useEffect } from "react";

/**
 * Last-resort error page, used only if the shared layout itself fails.
 * It replaces the whole document, so it brings its own <html>, styles and fonts.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en-NG">
      <body className="flex min-h-dvh items-center bg-resist text-pit">
        <title>Ile Aro is having trouble</title>
        <main className="mx-auto w-full max-w-[44rem] px-4 py-16 sm:px-6">
          <p className="font-stencil text-3xl tracking-[0.05em]">Ile Aro</p>
          <h1 className="font-stencil mt-8 text-6xl">The shop can&apos;t load right now</h1>
          <p className="mt-4 max-w-[34rem] text-lg">
            Something went wrong on our side, not yours. Your cart and any orders are safe. Try again in a moment.
          </p>
          <p className="mt-8">
            <button type="button" onClick={() => retry()} className="btn btn-primary">
              Try again
            </button>
          </p>
          {error.digest ? <p className="mt-8 text-sm text-faded">Error reference: {error.digest}</p> : null}
          <p className="mt-2 text-sm text-faded">
            Running this shop?{" "}
            <a href="/api/health" className="link">
              Open the setup check
            </a>{" "}
            to see what needs fixing.
          </p>
        </main>
      </body>
    </html>
  );
}
