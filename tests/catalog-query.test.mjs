import test from "node:test";
import assert from "node:assert/strict";
import { parseCatalogQuery, escapeLike, CatalogQueryError } from "../lib/catalog-query.mjs";

test("defaults and pagination offset", () => {
  assert.deepEqual(parseCatalogQuery(new URLSearchParams()), { page: 1, limit: 20, search: "", offset: 0 });
  assert.deepEqual(parseCatalogQuery(new URLSearchParams("page=3&limit=10&search=+Elden+Ring+")),
    { page: 3, limit: 10, search: "Elden Ring", offset: 20 });
});

test("rejects malformed, duplicate and oversized parameters", () => {
  for (const query of ["page=0", "page=-1", "page=1.5", "page=1e2", "page=abc", "page=", "page=1000001", "limit=101", "limit=0", "page=1&page=2", "search=a&search=b", `search=${"x".repeat(201)}`]) {
    assert.throws(() => parseCatalogQuery(new URLSearchParams(query)), CatalogQueryError, query);
  }
});

test("search escapes wildcards and escape character", () => {
  assert.equal(escapeLike("100%_\\done"), "100\\%\\_\\\\done");
  assert.equal(escapeLike("Elden Ring"), "Elden Ring");
});
