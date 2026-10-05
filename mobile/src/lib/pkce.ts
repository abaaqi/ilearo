import * as Crypto from "expo-crypto";

/**
 * PKCE (RFC 7636): the app keeps a random verifier and sends only its SHA-256
 * hash (the challenge) when sign-in starts. The shop will only swap the
 * one-time sign-in code for a session if the same app proves it holds the
 * verifier, so a code intercepted on its way back to the app is useless.
 */

const toBase64Url = (base64: string) => base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = toBase64Url(bytesToBase64(Crypto.getRandomBytes(32)));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return { verifier, challenge: toBase64Url(digest) };
}
