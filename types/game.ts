export interface Game {
  id: number;
  title: string;
  slug: string;

  description?: string | null;
  coverUrl?: string | null;

  releaseDate?: string;

  developer?: string | null;
  publisher?: string | null;
  igdbId?: number | null;
  rawgId?: number | null;
  steamId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}
