import type { Game } from "./game";
import type { Mood, RecommendationResult } from "@/lib/recommendations.mjs";

export interface RecommendationRequest {
  mood: Mood;
  platform?: string;
  preferredGenres?: string[];
  excludeIds?: number[];
  sessionMinutes?: number;
  includeUnknownSession?: boolean;
  limit?: number;
}

export type RecommendationResponse = RecommendationResult<Game>;
