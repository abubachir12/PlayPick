import test from "node:test";
import assert from "node:assert/strict";
import { AuthError, DUMMY_HASH, hashPassword, hashToken, isSameOrigin, newSessionToken, normalizeEmail,
  parseLogin, parseRegistration, sessionExpiry, verifyPassword } from "../lib/auth.mjs";
import { readJsonBody, RequestBodyError } from "../lib/http.mjs";

test("registration normalizes email and name, rejects bad input", () => {
  assert.deepEqual(parseRegistration({ email: "  Alice@Example.COM ", password: "12345678", name: "  Алиса   П. " }),
    { email: "alice@example.com", password: "12345678", name: "Алиса П." });
  assert.equal(parseRegistration({ email: "bob@mail.ru", password: "12345678" }).name, "bob");
  for (const input of [null, [], { email: "no-at", password: "12345678" }, { email: "a@b.c", password: "short" },
    { email: "a@b.c", password: "x".repeat(129) }, { email: "a@b.c", password: "12345678", admin: true },
    { email: "a@b.c", password: "12345678", name: "x".repeat(41) }]) {
    assert.throws(() => parseRegistration(input), AuthError);
  }
});

test("login errors never say which field was wrong", () => {
  assert.deepEqual(parseLogin({ email: "A@B.C", password: "p" }), { email: "a@b.c", password: "p" });
  for (const input of [{ email: "", password: "p" }, { email: "a@b.c", password: "" }, { email: "a@b.c", password: 5 }]) {
    assert.throws(() => parseLogin(input), (error) => error instanceof AuthError && error.status === 401
      && error.message === "Неверная почта или пароль");
  }
  assert.equal(normalizeEmail(5), "");
});

test("passwords hash with a fresh salt and verify only with the right password", async () => {
  const first = await hashPassword("correct horse");
  const second = await hashPassword("correct horse");
  assert.notEqual(first, second);
  assert.match(first, /^scrypt\$16384\$8\$1\$/);
  assert.ok(!first.includes("correct horse"));
  assert.equal(await verifyPassword("correct horse", first), true);
  assert.equal(await verifyPassword("wrong horse", first), false);
  assert.equal(await verifyPassword("anything", "plain-text"), false);
  assert.equal(await verifyPassword("anything", DUMMY_HASH), false);
});

test("session tokens are random and stored only as a hash", () => {
  const token = newSessionToken();
  assert.ok(token.length >= 43);
  assert.notEqual(token, newSessionToken());
  assert.match(hashToken(token), /^[0-9a-f]{64}$/);
  assert.equal(hashToken(token), hashToken(token));
  assert.equal(sessionExpiry(0).getTime(), 30 * 24 * 60 * 60 * 1000);
});

test("state-changing requests must come from the same origin", () => {
  const req = (origin) => new Request("https://playpick.app/api/auth/login", { method: "POST", headers: origin ? { origin } : {} });
  assert.equal(isSameOrigin(req("https://playpick.app")), true);
  assert.equal(isSameOrigin(req("https://evil.example")), false);
  assert.equal(isSameOrigin(req(null)), false);
  assert.equal(isSameOrigin(req("not a url")), false);
});

test("JSON body reader enforces type and size", async () => {
  const post = (body, type = "application/json") => new Request("http://x/", { method: "POST", headers: { "content-type": type }, body });
  assert.deepEqual(await readJsonBody(post('{"a":1}')), { a: 1 });
  await assert.rejects(readJsonBody(post("{}", "text/plain")), (e) => e instanceof RequestBodyError && e.status === 415);
  await assert.rejects(readJsonBody(post("{bad")), (e) => e instanceof RequestBodyError && e.status === 400);
  await assert.rejects(readJsonBody(post(JSON.stringify({ x: "y".repeat(100) }), undefined), 50), (e) => e.status === 413);
});
