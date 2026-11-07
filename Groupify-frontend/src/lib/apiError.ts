export class ApiError extends Error {
  status: number;
  statusCode: number;
  isNetworkError: boolean;

  constructor(
    message: string,
    opts: { status?: number; isNetworkError?: boolean } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status ?? 0;
    this.statusCode = opts.status ?? 0;
    this.isNetworkError = opts.isNetworkError ?? false;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
