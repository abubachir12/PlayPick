export class AuthError extends Error {
  constructor(message: string, status?: number);
  status: number;
}
export const SESSION_COOKIE: string;
export const SESSION_DAYS: number;
export const DUMMY_HASH: string;
export function normalizeEmail(value: unknown): string;
export function parseRegistration(input: unknown): { email: string; password: string; name: string };
export function parseLogin(input: unknown): { email: string; password: string };
export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, stored: string): Promise<boolean>;
export function newSessionToken(): string;
export function hashToken(token: string): string;
export function sessionExpiry(now?: number): Date;
export function isSameOrigin(request: Request): boolean;
