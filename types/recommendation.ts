import type { Game } from "./game";
import type { GameLength, Mood, RecommendationResult } from "@/lib/recommendations.mjs";

export interface RecommendationRequest {
  mood: Mood;
  platform?: string;
  preferredGenres?: string[];
  excludeIds?: number[];
  likedIds?: number[];
  sessionMinutes?: number;
  includeUnknownSession?: boolean;
  freeOnly?: boolean;
  length?: GameLength;
  limit?: number;
}

export type RecommendationResponse = RecommendationResult<Game>;
