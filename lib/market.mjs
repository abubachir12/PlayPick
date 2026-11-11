import { extractPrice } from "./steam.mjs";
import { compactPrice, EXTRA_REGIONS, MAIN_REGION } from "./regions.mjs";

// Prices of the given Steam apps in every tracked region. All regions are requested together
// (9 requests per region for ~800 games), so the daily refresh fits a short serverless function.
// Result: Map<steamId, { isFree?, priceFinal, priceInitial, discountPercent, priceCurrency, prices }>.
// A game is present only if the main region answered for it; a missing extra region leaves that key out,
// so the caller can keep yesterday's value for it.
export async function collectRegionPrices(steam, steamIds) {
  const regions = [MAIN_REGION, ...EXTRA_REGIONS];
  const answers = await Promise.all(regions.map((region) => steam.prices(steamIds, region).catch(() => null)));
  const main = answers[0];
  if (!main) throw new Error("Steam не отдал цены основного региона");
  const result = new Map();
  for (const id of steamIds) {
    if (!main.has(id)) continue;
    const { isFree: _unused, ...price } = extractPrice({ price_overview: main.get(id) });
    void _unused;
    const prices = {};
    EXTRA_REGIONS.forEach((region, index) => {
      const answer = answers[index + 1];
      // No answer for the region at all (request failed) → keep the old value; answered → price or "not sold" (null).
      if (answer) prices[region] = answer.has(id) ? compactPrice(extractPrice({ price_overview: answer.get(id) })) : null;
    });
    result.set(id, { ...price, prices });
  }
  return result;
}
