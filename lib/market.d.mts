import type { RegionPrice } from "./regions.mjs";

export function collectRegionPrices(
  steam: { prices(appIds: number[], region?: string): Promise<Map<number, unknown>> },
  steamIds: number[],
): Promise<Map<number, {
  priceFinal: number | null;
  priceInitial: number | null;
  discountPercent: number | null;
  priceCurrency: string | null;
  prices: Record<string, RegionPrice | null>;
}>>;
