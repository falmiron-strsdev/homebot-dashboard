// Server-side orchestrator HTTP client.
// Used ONLY in API routes — never imported by client components.
// The API key stays server-side and is never exposed to the browser.

const ORCH_URL = process.env.ORCH_URL ?? "http://192.168.1.222:8000";
const ORCH_API_KEY = process.env.ORCH_API_KEY ?? "";

export async function orchFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${ORCH_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (ORCH_API_KEY) {
    headers["Authorization"] = `Bearer ${ORCH_API_KEY}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    // Don't cache — these are live operational reads
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Orchestrator ${res.status} ${res.statusText} [${path}]${body ? `: ${body}` : ""}`
    );
  }

  return res.json() as Promise<T>;
}
