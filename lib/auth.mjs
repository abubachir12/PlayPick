import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export class AuthError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const SESSION_COOKIE = "playpick_session";
export const SESSION_DAYS = 30;

// N=2^14, r=8, p=1: the OWASP baseline for scrypt; ~50 ms per hash on a serverless CPU.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLowerCase() : "";
}

function cleanName(value, email) {
  const name = typeof value === "string" ? value.normalize("NFKC").replace(/\s+/g, " ").trim() : "";
  return name || email.split("@")[0].slice(0, 40);
}

function checkPassword(password) {
  if (typeof password !== "string" || password.length < 8) throw new AuthError("Пароль должен быть не короче 8 символов");
  if (password.length > 128) throw new AuthError("Пароль должен быть не длиннее 128 символов");
}

function checkObject(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AuthError("Требуется JSON-объект");
  if (Object.keys(input).some((key) => !allowed.includes(key))) throw new AuthError("Неизвестное поле в запросе");
}

export function parseRegistration(input) {
  checkObject(input, ["email", "password", "name"]);
  const email = normalizeEmail(input.email);
  if (!EMAIL.test(email) || email.length > 254) throw new AuthError("Укажите корректную почту");
  checkPassword(input.password);
  const name = cleanName(input.name, email);
  if (name.length > 40) throw new AuthError("Имя должно быть не длиннее 40 символов");
  return { email, password: input.password, name };
}

export function parseLogin(input) {
  checkObject(input, ["email", "password"]);
  const email = normalizeEmail(input.email);
  // Login never explains which part was wrong, so malformed input gets the same answer as a bad password.
  if (!email || typeof input.password !== "string" || !input.password || input.password.length > 128) {
    throw new AuthError("Неверная почта или пароль", 401);
  }
  return { email, password: input.password };
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const parts = typeof stored === "string" ? stored.split("$") : [];
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  const actual = await scrypt(password, salt, expected.length, { N, r, p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// A dummy hash keeps "unknown email" as slow as "wrong password", so timing does not reveal accounts.
export const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now = Date.now()) {
  return new Date(now + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

// Cookies are SameSite=Lax; for state-changing requests we also require a same-origin Origin header.
export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
