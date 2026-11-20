import type { ApiState } from "../domain/api";

/** An API call that didn't succeed. `fields` names the invalid fields on a 400. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0);
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    fields?: Record<string, string>;
  };
  if (res.ok) return data as T;

  if (res.status === 401) {
    throw new ApiError("You've been signed out. Reload the page to sign in again.", 401);
  }
  if (res.status === 400) throw new ApiError("Some fields need fixing.", 400, data.fields);
  throw new ApiError(data.error ?? "Something went wrong. Try again.", res.status);
}

export const api = {
  state: () => request<ApiState>("GET", "/api/state"),
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: (path: string) => request<void>("DELETE", path),
};
