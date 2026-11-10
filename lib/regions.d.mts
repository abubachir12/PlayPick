export type RegionId = "us" | "kz" | "ru" | "ua" | "by";
export type RegionPrice = { final: number; initial: number; discount: number; currency: string };
export const REGIONS: Array<{ id: RegionId; label: string; currency: string }>;
export const MAIN_REGION: RegionId;
export const EXTRA_REGIONS: RegionId[];
export const REGION_IDS: RegionId[];
export function regionPrice(game: {
  priceFinal?: number | null; priceInitial?: number | null; discountPercent?: number | null;
  priceCurrency?: string | null; prices?: Record<string, RegionPrice | null> | null;
} | null | undefined, region: string): RegionPrice | null;
export function compactPrice(price: {
  priceFinal: number | null; priceInitial: number | null; discountPercent: number | null; priceCurrency: string | null;
} | null | undefined): RegionPrice | null;
