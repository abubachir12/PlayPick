export type Mood = "relax" | "challenge" | "story" | "explore" | "social";
export type GameLength = "short" | "medium" | "long";
export const ALGORITHM: "rules-v2";
/** Series name without numbers and subtitles: "Grand Theft Auto IV" → "grand theft auto". */
export function seriesKey(title: string): string;
export interface RecommendationPreferences {
  mood: Mood;
  platform: string | null;
  preferredGenres: string[];
  excludeIds: number[];
  likedIds: number[];
  sessionMinutes: number | null;
  includeUnknownSession: boolean;
  freeOnly: boolean;
  length: GameLength | null;
  limit: number;
}
export interface RecommendationCandidate {
  id: number;
  title?: string;
  rawgId?: number | null;
  platforms?: string[] | null;
  genres?: string[] | null;
  tags?: string[] | null;
  rating?: number | null;
  metacritic?: number | null;
  playtime?: number | null;
  developer?: string | null;
}
export interface RecommendedGame<T> {
  game: T;
  score: number;
  reasons: { code: string; value: string; text: string }[];
  sessionFit: {
    status: "not-requested" | "estimated-fit" | "unknown";
    minimumMinutes: number | null;
    basis: "editorial" | null;
    sourceUrl: string | null;
    note: string | null;
  };
}
export interface RecommendationResult<T> {
  items: RecommendedGame<T>[];
  meta: {
    algorithm: "rules-v2";
    preferences: RecommendationPreferences;
    eligibleCount: number;
    returnedCount: number;
    session: { unknownIncluded: number; unknownExcluded: number };
    likedUsed: number;
    warnings: { code: string; text: string }[];
  };
}
export class RecommendationError extends Error {
  constructor(message: string, status?: number);
  status: number;
}
export function parseRecommendationPreferences(input: unknown): RecommendationPreferences;
export function readRecommendationRequest(request: Request): Promise<RecommendationPreferences>;
export function recommendationOptions(): {
  algorithm: string;
  moods: { id: Mood; label: string }[];
  lengths: { id: GameLength; label: string }[];
  limit: { min: number; max: number; default: number };
  sessionMinutes: { min: number; max: number };
  sessionEstimates: string;
  unknownSessionsIncludedByDefault: boolean;
  catalogFiltersUrl: string;
};
export function rankRecommendations<T extends RecommendationCandidate>(games: T[], preferences: RecommendationPreferences): RecommendationResult<T>;
