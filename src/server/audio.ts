/** An R2 object as a playable (or downloadable) MP3 response. */
export function audioResponse(
  object: R2ObjectBody,
  title: string,
  download: boolean,
): Response {
  const headers = new Headers({
    "content-type": object.httpMetadata?.contentType ?? "audio/mpeg",
    "content-length": String(object.size),
    "cache-control": "private, no-store",
  });
  if (download) {
    const name = title.replace(/[^\w\s.-]+/g, "").trim() || "song";
    headers.set(
      "content-disposition",
      `attachment; filename="${name}.mp3"; filename*=UTF-8''${encodeURIComponent(name)}.mp3`,
    );
  }
  return new Response(object.body, { headers });
}
