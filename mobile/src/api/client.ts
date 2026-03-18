const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "");

export const isApiConfigured = Boolean(configuredUrl);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function apiUrl(path: string) {
  if (!configuredUrl) {
    throw new ApiError(
      "The Chronous API URL is missing. Set EXPO_PUBLIC_API_URL before starting Expo.",
      503,
    );
  }
  return path.startsWith("http") ? path : `${configuredUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || !("detail" in payload)) return fallback;
  const detail = (payload as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item ? String(item.msg) : "Invalid request.",
      )
      .join(" ");
  }
  return fallback;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), init);
  } catch {
    throw new ApiError(
      `Could not reach the Chronous API at ${configuredUrl}. Start FastAPI on 0.0.0.0 and keep both devices on the same network.`,
      503,
    );
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    throw new ApiError(errorMessage(payload, "The request could not be completed."), response.status);
  }
  return payload as T;
}

export function jsonRequest<T>(path: string, body: unknown, init: RequestInit = {}) {
  return apiRequest<T>(path, {
    ...init,
    method: init.method ?? "POST",
    headers: { "Content-Type": "application/json", ...init.headers },
    body: JSON.stringify(body),
  });
}
