export class SteamError extends Error {}
export type SteamPrice = {
  isFree: boolean;
  priceFinal: number | null;
  priceInitial: number | null;
  discountPercent: number | null;
  priceCurrency: string | null;
};
export function extractPrice(store: unknown): SteamPrice;
export function createSteamClient(options?: { fetchImpl?: typeof fetch; wait?: (ms: number) => Promise<unknown> }): {
  listPopular(page?: number): Promise<Array<{ appid: number; name: string; ccu?: number; positive: number; negative: number }>>;
  spyDetails(appId: number): Promise<Record<string, unknown>>;
  storeDetails(appId: number, region?: string): Promise<Record<string, unknown> | null>;
  prices(appIds: number[], region?: string): Promise<Map<number, unknown>>;
  playersNow(appIds: number[], concurrency?: number): Promise<Map<number, number>>;
  search(term: string, region?: string): Promise<Array<{ appid: number; name: string }>>;
};
