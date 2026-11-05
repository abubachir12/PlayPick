export class RequestBodyError extends Error {
  constructor(message: string, status?: number);
  status: number;
}
export function readJsonBody(request: Request, max?: number): Promise<unknown>;
