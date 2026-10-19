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
  createdAt?: string;
  updatedAt?: string;
}
