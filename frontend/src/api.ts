const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8080";

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export function toQuery(params: QueryParams = {}): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function apiGet<T>(path: string, params: QueryParams = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}${toQuery(params)}`);
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return body as T;
}

export { API_BASE };

async function attempt<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return body as T;
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return attempt<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return attempt<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
