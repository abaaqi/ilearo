import * as Device from "expo-device";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { ApiError, api, setCredentials, setSignedOutHandler } from "@/lib/api";
import { SHOP_URL } from "@/lib/config";
import { createPkcePair } from "@/lib/pkce";
import { storage } from "@/lib/storage";
import type { User } from "@/lib/types";

/*
 * Signing in uses the website's own Google sign-in, so the app and the
 * website share one account:
 *
 *   1. Make a PKCE pair, open <shop>/api/auth/google?client=app&… in the
 *      phone's browser (a Chrome Custom Tab / Safari sheet, which Google allows).
 *   2. The shopper picks their Google account. The website finds or creates
 *      their account, then sends the browser to ilearo://auth?code=… (or the
 *      exp:// address Expo Go is using).
 *   3. Swap the code and the PKCE verifier for this app's own session token,
 *      kept in the phone's secure storage.
 */

const SESSION_KEY = "ilearo.session";
const GUEST_CART_KEY = "ilearo.guestCart";
const PENDING_KEY = "ilearo.pendingSignIn";

type StoredSession = { token: string; user: User };
type Status = "loading" | "signedOut" | "signedIn";

type SessionValue = {
  status: Status;
  user: User | null;
  token: string | null;
  /** Signed-out shoppers' cart, kept on the server under this id. */
  guestCartId: string | null;
  signingIn: boolean;
  /** Why the last sign-in didn't work, in words for the shopper. */
  signInMessage: string | null;
  signIn: () => Promise<boolean>;
  finishSignIn: (params: { code?: string | null; error?: string | null }) => Promise<boolean>;
  signOut: () => Promise<void>;
  rememberGuestCart: (id: string | null) => Promise<void>;
  clearSignInMessage: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

const SIGN_IN_ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled. You can try again whenever you're ready.",
  expired: "That sign-in took too long or was interrupted. Please try again.",
  state: "That sign-in took too long or was interrupted. Please try again.",
  unverified: "Your Google account's email address isn't verified yet. Verify it with Google, then try again.",
  google: "Google didn't finish signing you in. Try again in a moment.",
  not_configured: "Google sign-in isn't set up on the shop's website yet.",
};

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Shown on the website's account page and kept with the session, e.g. "Pixel 8 (Android 15)". */
function deviceName(): string {
  if (Platform.OS === "web") return "Web browser";
  const model = Device.modelName ?? (Platform.OS === "ios" ? "iPhone" : "Android phone");
  return `${model} (${Device.osName ?? Platform.OS} ${Device.osVersion ?? ""})`.replace(" )", ")");
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [guestCartId, setGuestCartId] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInMessage, setSignInMessage] = useState<string | null>(null);
  /** Codes already being swapped, so the browser result and the deep link don't both use one. */
  const handledCodes = useRef(new Set<string>());
  const guestCartRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  /** Set once anything has decided who is signed in, so the start-up read can't undo a newer sign-in. */
  const settled = useRef(false);

  const applySession = useCallback((next: StoredSession | null) => {
    settled.current = true;
    tokenRef.current = next?.token ?? null;
    setSession(next);
    setStatus(next ? "signedIn" : "signedOut");
    setCredentials({ token: tokenRef.current, guestCartId: next ? null : guestCartRef.current });
  }, []);

  const forgetSession = useCallback(async () => {
    await storage.remove(SESSION_KEY);
    applySession(null);
  }, [applySession]);

  // Start-up: pick up a stored session and guest cart.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [stored, guest] = await Promise.all([storage.get(SESSION_KEY), storage.get(GUEST_CART_KEY)]);
      // A sign-in that finished first (the app was opened by the sign-in link) wins.
      if (cancelled || settled.current) return;
      guestCartRef.current = guest;
      setGuestCartId(guest);
      const saved = parse<StoredSession>(stored);
      applySession(saved?.token && saved.user ? saved : null);
      if (saved?.token) {
        // Refresh the name and photo in case they changed on Google (a 401 signs the app out).
        api
          .me()
          .then(({ user }) => {
            if (cancelled || tokenRef.current !== saved.token) return;
            const next = { token: saved.token, user };
            void storage.set(SESSION_KEY, JSON.stringify(next));
            setSession(next);
          })
          .catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  // The server says the token stopped working (signed out elsewhere, or expired).
  useEffect(() => {
    setSignedOutHandler(() => {
      void forgetSession();
      setSignInMessage("You've been signed out. Sign in again to carry on.");
    });
    return () => setSignedOutHandler(null);
  }, [forgetSession]);

  const rememberGuestCart = useCallback(async (id: string | null) => {
    // Only signed-out shoppers have a guest cart; the server never sends one to a signed-in app.
    if (tokenRef.current || id === guestCartRef.current) return;
    guestCartRef.current = id;
    setGuestCartId(id);
    if (id) await storage.set(GUEST_CART_KEY, id);
    else await storage.remove(GUEST_CART_KEY);
    setCredentials({ token: null, guestCartId: id });
  }, []);

  const finishSignIn = useCallback(
    async ({ code, error }: { code?: string | null; error?: string | null }): Promise<boolean> => {
      if (error) {
        setSignInMessage(SIGN_IN_ERRORS[error] ?? SIGN_IN_ERRORS.google!);
        return false;
      }
      if (!code || handledCodes.current.has(code)) return false;
      handledCodes.current.add(code);

      const pending = parse<{ verifier: string }>(await storage.get(PENDING_KEY));
      if (!pending) {
        setSignInMessage(SIGN_IN_ERRORS.expired!);
        return false;
      }
      setSigningIn(true);
      try {
        const result = await api.exchangeSignInCode({
          code,
          codeVerifier: pending.verifier,
          guestCartId: guestCartRef.current,
          device: deviceName(),
        });
        await storage.remove(PENDING_KEY);
        const next = { token: result.token, user: result.user };
        await storage.set(SESSION_KEY, JSON.stringify(next));
        // A guest cart has just joined the account's cart on the server.
        guestCartRef.current = null;
        setGuestCartId(null);
        await storage.remove(GUEST_CART_KEY);
        setSignInMessage(null);
        applySession(next);
        return true;
      } catch (err) {
        setSignInMessage(err instanceof ApiError ? err.message : SIGN_IN_ERRORS.google!);
        return false;
      } finally {
        setSigningIn(false);
      }
    },
    [applySession],
  );

  const signIn = useCallback(async (): Promise<boolean> => {
    if (!SHOP_URL) return false;
    setSignInMessage(null);
    setSigningIn(true);
    try {
      const { verifier, challenge } = await createPkcePair();
      const redirectUri = Linking.createURL("auth");
      await storage.set(PENDING_KEY, JSON.stringify({ verifier }));
      const url =
        `${SHOP_URL}/api/auth/google?client=app` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${encodeURIComponent(challenge)}`;
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
      if (result.type !== "success") return false;
      const { queryParams } = Linking.parse(result.url);
      const value = (key: string) => {
        const v = queryParams?.[key];
        return typeof v === "string" ? v : null;
      };
      return await finishSignIn({ code: value("code"), error: value("error") });
    } catch {
      setSignInMessage("Couldn't open the sign-in page. Try again.");
      return false;
    } finally {
      setSigningIn(false);
    }
  }, [finishSignIn]);

  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } catch {
      // Signed out on the phone either way; the server session runs out on its own.
    }
    await forgetSession();
  }, [forgetSession]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user: session?.user ?? null,
      token: session?.token ?? null,
      guestCartId,
      signingIn,
      signInMessage,
      signIn,
      finishSignIn,
      signOut,
      rememberGuestCart,
      clearSignInMessage: () => setSignInMessage(null),
    }),
    [status, session, guestCartId, signingIn, signInMessage, signIn, finishSignIn, signOut, rememberGuestCart],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}
