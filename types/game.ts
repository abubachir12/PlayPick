export interface Game {
  id: number;
  title: string;
  slug: string;

  description?: string;
  coverUrl?: string;

  releaseDate?: string;

  developer?: string;
  publisher?: string;
}