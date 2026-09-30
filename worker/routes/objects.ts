import { authenticateSession, type SessionConfig } from "../auth/session.ts";
import type { IdentityRepository } from "../db/repository.ts";
interface ObjectEnv {
  OBJECTS?: R2Bucket;
}
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export async function handleObjects(
  request: Request,
  url: URL,
  env: ObjectEnv,
  repository: IdentityRepository,
  config: SessionConfig,
): Promise<Response | null> {
  if (
    url.pathname !== "/api/objects/upload" &&
    !url.pathname.startsWith("/objects/")
  )
    return null;
  if (!env.OBJECTS)
    return Response.json(
      { error: "Object storage unavailable" },
      { status: 503 },
    );
  const key = url.pathname.slice("/objects/".length);
  if (request.method === "GET" && url.pathname.startsWith("/objects/")) {
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(key))
      return new Response(null, { status: 404 });
    const object = await env.OBJECTS.get(key);
    if (!object) return new Response(null, { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type":
          object.httpMetadata?.contentType || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public,max-age=31536000,immutable",
      },
    });
  }
  const actor = await authenticateSession(
    request,
    repository,
    config,
    "teacher",
  );
  if (!actor)
    return Response.json(
      { error: "Teacher authentication required" },
      { status: 401 },
    );
  if (url.pathname === "/api/objects/upload" && request.method === "POST") {
    const id = crypto.randomUUID();
    return Response.json({
      uploadURL: `/objects/${actor.actorId}/${id}`,
      objectPath: `/objects/${actor.actorId}/${id}`,
    });
  }
  if (
    request.method === "PUT" &&
    key.startsWith(actor.actorId + "/") &&
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(key)
  ) {
    const type = request.headers.get("content-type") || "";
    if (!TYPES.has(type))
      return Response.json(
        { error: "Use PNG, JPEG, WebP or GIF" },
        { status: 415 },
      );
    const declared = Number(request.headers.get("content-length"));
    if (declared > 5 * 1024 * 1024)
      return Response.json(
        { error: "Maximum image size is 5MB" },
        { status: 413 },
      );
    if (!request.body) return new Response(null, { status: 400 });
    const reader = request.body.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5 * 1024 * 1024) {
        await reader.cancel();
        return Response.json(
          { error: "Maximum image size is 5MB" },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const valid =
      type === "image/png"
        ? bytes[0] === 137 &&
          bytes[1] === 80 &&
          bytes[2] === 78 &&
          bytes[3] === 71
        : type === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : type === "image/gif"
            ? String.fromCharCode(...bytes.slice(0, 6)).startsWith("GIF8")
            : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
              String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!valid)
      return Response.json(
        { error: "Image format does not match its content type" },
        { status: 415 },
      );
    if (await env.OBJECTS.head(key))
      return Response.json({ error: "Upload already exists" }, { status: 409 });
    await env.OBJECTS.put(key, bytes, { httpMetadata: { contentType: type } });
    return Response.json({ objectPath: url.pathname }, { status: 201 });
  }
  return Response.json({ error: "Forbidden" }, { status: 403 });
}
