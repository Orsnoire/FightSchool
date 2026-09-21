const PASSWORD_ALGORITHM = "pbkdf2_sha256_peppered";
const PASSWORD_ITERATIONS = 100_000;
const encoder = new TextEncoder();

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }
  return difference === 0;
}

async function pepperPassword(password: string, pepper: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(password)));
}

async function derivePassword(password: string, pepper: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", await pepperPassword(password, pepper), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations,
  }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, pepper: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derivePassword(password, pepper, salt, PASSWORD_ITERATIONS);
  return [PASSWORD_ALGORITHM, PASSWORD_ITERATIONS, encodeBase64Url(salt), encodeBase64Url(hash)].join("$");
}

export async function verifyPassword(password: string, storedHash: string, pepper: string): Promise<boolean> {
  const [algorithm, rawIterations, rawSalt, rawHash] = storedHash.split("$");
  const iterations = Number(rawIterations);
  if (
    algorithm !== PASSWORD_ALGORITHM
    || !Number.isSafeInteger(iterations)
    || iterations < PASSWORD_ITERATIONS
    || !rawSalt
    || !rawHash
  ) return false;

  try {
    const expected = decodeBase64Url(rawHash);
    const actual = await derivePassword(password, pepper, decodeBase64Url(rawSalt), iterations);
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createOpaqueToken(): string {
  return encodeBase64Url(randomBytes(32));
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return encodeBase64Url(new Uint8Array(digest));
}

async function signToken(token: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(token)));
}

export async function encodeSignedToken(token: string, secret: string): Promise<string> {
  return token + "." + encodeBase64Url(await signToken(token, secret));
}

export async function decodeSignedToken(value: string, secret: string): Promise<string | null> {
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const token = value.slice(0, separator);
  try {
    const supplied = decodeBase64Url(value.slice(separator + 1));
    const expected = await signToken(token, secret);
    return constantTimeEqual(supplied, expected) ? token : null;
  } catch {
    return null;
  }
}
