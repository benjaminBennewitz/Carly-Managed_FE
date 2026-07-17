// src/app/core/api/api.models.ts

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiFieldError {
  code?: string;
  message?: string;
  string?: string;
}

export interface ApiErrorResponse {
  detail?: string;
  errors?: Record<string, string[] | ApiFieldError[]>;
}

/** Normalisiert paginierte und direkte Listen-Antworten. */
export function unwrapCollection<T>(response: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(response) ? response : response.results;
}
