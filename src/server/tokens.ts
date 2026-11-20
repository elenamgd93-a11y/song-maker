/** A random 24-character share token (18 bytes, base64url). */
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_");
}
