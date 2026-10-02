import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdireArt } from "@/components/adire/art";
import { getCurrentUser } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/oidc";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled. You can try again whenever you're ready.",
  expired: "That sign-in took too long or was opened in another browser. Start again below.",
  state: "We couldn't match that sign-in to this browser. Start again below.",
  unverified: "Your Google account's email address isn't verified yet. Verify it with Google, then try again.",
  google: "Google didn't finish signing you in. Try again in a moment.",
  not_configured:
    "Google sign-in isn't set up on this site yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the server's environment variables.",
};

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(typeof params.returnTo === "string" ? params.returnTo : undefined);
  if (await getCurrentUser()) redirect(returnTo);

  const error = typeof params.error === "string" ? (ERRORS[params.error] ?? ERRORS.google) : null;
  const forCheckout = returnTo.startsWith("/checkout");
  const startUrl = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className="mx-auto grid max-w-[76rem] gap-12 px-4 pt-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:px-8">
      <div className="max-w-[34rem]">
        <h1 className="font-stencil text-6xl">{forCheckout ? "Sign in to check out" : "Sign in"}</h1>

        {error ? (
          <p role="alert" className="mt-6 border-l-4 border-alert bg-cloth px-5 py-4 font-semibold text-alert">
            {error}
          </p>
        ) : null}

        <p className="mt-6 text-lg">
          Use your Google account. We get your name, email address and profile photo from Google to set up your account
          and send order emails. We never see your password.
        </p>
        {forCheckout ? <p className="mt-3">Your cart is saved and will be waiting when you&apos;re back.</p> : null}

        <a href={startUrl} className="btn btn-primary mt-8 w-full sm:w-auto sm:min-w-72">
          Continue with Google
        </a>
      </div>

      <div aria-hidden="true" className="hidden aspect-[4/5] overflow-hidden md:block">
        <AdireArt spec={{ pattern: "sunburst", seed: 2026, tone: "deep" }} className="block h-full w-full" />
      </div>
    </div>
  );
}
