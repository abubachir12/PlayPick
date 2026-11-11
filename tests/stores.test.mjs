import test from "node:test";
import assert from "node:assert/strict";
import { parseOffers, parseStoreNames } from "../lib/stores.mjs";

test("store offers are sorted from the cheapest, one per store, with readable names", () => {
  const { offers, lowestEver } = parseOffers({
    cheapestPriceEver: { price: "17.99", date: 1781701951 },
    deals: [
      { storeID: "11", dealID: "humble%3D", price: "59.99", retailPrice: "59.99" },
      { storeID: "25", dealID: "epic", price: "29.99", retailPrice: "59.99" },
      { storeID: "1", dealID: "steam", price: "59.99", retailPrice: "59.99" },
      { storeID: "1", dealID: "steam-old", price: "64.99", retailPrice: "64.99" },
      { storeID: "99", dealID: "", price: "1.00" },
      { storeID: "7", dealID: "gog", price: "nope" },
    ],
  }, { 99: "Ignored" });
  assert.deepEqual(offers.map((offer) => [offer.store, offer.price, offer.discount, offer.official]), [
    ["Epic Games Store", 2999, 50, true],
    ["Steam", 5999, 0, true],
    ["Humble Store", 5999, 0, false],
  ]);
  assert.equal(offers[2].url, "https://www.cheapshark.com/redirect?dealID=humble%3D");
  assert.deepEqual(lowestEver, { price: 1799, date: "2026-06-17" });
});

test("broken or empty CheapShark answers give no offers instead of throwing", () => {
  assert.deepEqual(parseOffers(null), { offers: [], lowestEver: null });
  assert.deepEqual(parseOffers({ deals: "x" }), { offers: [], lowestEver: null });
  const { offers } = parseOffers({ deals: [{ storeID: "42", dealID: "a", price: "5", retailPrice: "4" }] }, { 42: "New Shop" });
  assert.deepEqual(offers.map((offer) => [offer.store, offer.initial, offer.discount, offer.official]), [["New Shop", 500, 0, false]]);
});

test("only active stores are named", () => {
  assert.deepEqual(parseStoreNames([
    { storeID: "1", storeName: "Steam", isActive: 1 },
    { storeID: "4", storeName: "Amazon", isActive: 0 },
  ]), { 1: "Steam" });
  assert.deepEqual(parseStoreNames(undefined), {});
});
