"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-16 sm:px-6 lg:px-8">
      <h1 className="font-stencil text-6xl">This page didn&apos;t load</h1>
      <p className="mt-4 max-w-[34rem] text-lg">
        Something went wrong on our side. Your cart and orders are safe. Try again, and if it keeps happening, come back
        in a few minutes.
      </p>
      {error.digest ? <p className="mt-2 text-sm text-faded">Error reference: {error.digest}</p> : null}
      <p className="mt-2 text-sm text-faded">
        Running this shop?{" "}
        <a href="/api/health" className="link">
          Open the setup check
        </a>{" "}
        to see what needs fixing.
      </p>
      <p className="mt-8 flex flex-wrap gap-4">
        <button type="button" onClick={() => retry()} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-outline">
          Go to the home page
        </Link>
      </p>
    </div>
  );
}
