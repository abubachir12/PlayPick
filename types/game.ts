export interface Game {
  id: number;
  title: string;
  slug: string;

  description?: string | null;
  coverUrl?: string | null;

  releaseDate?: string | null;
  genres?: string[] | null;
  platforms?: string[] | null;
  tags?: string[] | null;
  rating?: number | null;
  metacritic?: number | null;
  playtime?: number | null;

  developer?: string | null;
  publisher?: string | null;
  igdbId?: number | null;
  rawgId?: number | null;
  steamId?: number | null;

  isFree?: boolean | null;
  /** Main region (US) price in minor units of priceCurrency; null when not sold there. */
  priceFinal?: number | null;
  /** Other regions by ID (kz, ru, ua, by); null inside when the game is not sold in that region. */
  prices?: Record<string, { final: number; initial: number; discount: number; currency: string } | null> | null;
  priceInitial?: number | null;
  discountPercent?: number | null;
  priceCurrency?: string | null;
  playersNow?: number | null;
  screenshots?: string[] | null;
  trailer?: { name: string; thumbnail: string; hls: string } | null;
  requirements?: string | null;
  hasRussian?: boolean | null;
  marketUpdatedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
