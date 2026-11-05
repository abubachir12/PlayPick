import type { GameLength, Mood, RecommendedGame } from "./recommendations.mjs";

export class ConsultantError extends Error {
  constructor(message: string, status?: number);
  status: number;
}
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };
export type Extraction = {
  mood: Mood;
  genres: string[];
  platform: string | null;
  similarTo: string[];
  freeOnly: boolean;
  length: GameLength | null;
  offTopic: boolean;
};
export const MAX_MESSAGES: number;
export const MAX_MESSAGE_LENGTH: number;
export function parseChatRequest(input: unknown): { messages: ChatMessage[]; likedIds: number[] };
export function buildExtractionMessages(messages: ChatMessage[], catalog: { genres: string[]; platforms: string[] }): LlmMessage[];
export function parseExtraction(text: unknown, catalog: { genres: string[]; platforms: string[] }): Extraction;
export function describeCandidate<T extends { id: number; title: string }>(item: RecommendedGame<T>): string;
export function buildAnswerMessages<T extends { id: number; title: string }>(messages: ChatMessage[], candidates: RecommendedGame<T>[], extraction: Extraction): LlmMessage[];
export function parseAnswer<T extends { id: number }>(text: unknown, candidates: RecommendedGame<T>[]): { reply: string; games: T[] };
