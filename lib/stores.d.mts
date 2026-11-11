export type StoreOffer = {
  storeId: number; store: string; official: boolean;
  /** US cents */
  price: number; initial: number; discount: number; url: string;
};
export type StoreOffers = { offers: StoreOffer[]; lowestEver: { price: number; date: string | null } | null };
export const CHEAPSHARK_API: string;
export const OFFICIAL_STORES: Set<number>;
export function storeName(id: number, names?: Record<number, string>): string;
export function parseOffers(details: unknown, storeNames?: Record<number, string>): StoreOffers;
export function parseStoreNames(stores: unknown): Record<number, string>;
