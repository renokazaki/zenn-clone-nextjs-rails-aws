const API_BASE_URL = process.env.API_BASE_URL ?? 'http://rails:3000/api/v1';

export async function fetchApi(path: string, options: RequestInit = {}): Promise<Response> {
  const hasBody = options.body !== undefined;
  const headers: HeadersInit = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function camelCaseKey(str: string): string {
  return str.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

export function toCamelCase(obj: Json): Json {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [camelCaseKey(key), toCamelCase(value)]),
    );
  }
  return obj;
}
