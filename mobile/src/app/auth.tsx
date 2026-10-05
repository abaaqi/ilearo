import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { useSession } from "@/state/session";
import { Loading } from "@/ui/feedback";

// In a browser, sign-in runs in a pop-up that lands here. This hands the result
// to the window that opened it and closes the pop-up. Elsewhere it does nothing.
const popup = WebBrowser.maybeCompleteAuthSession();

/**
 * Where the website sends the phone's browser after Google sign-in:
 * ilearo://auth?code=… (or exp://…/--/auth?code=… in Expo Go). On Android
 * the link also opens this screen; it finishes signing in and goes back.
 */
export default function AuthRedirect() {
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const { finishSignIn } = useSession();

  useEffect(() => {
    // The opening window finishes this sign-in; the closing pop-up mustn't use the code too.
    if (popup.type === "success") return;
    void finishSignIn({ code, error }).finally(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/account");
    });
  }, [code, error, finishSignIn]);

  return <Loading label="Signing you in" />;
}
