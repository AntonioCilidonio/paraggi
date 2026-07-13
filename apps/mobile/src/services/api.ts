import { supabase } from "@/services/supabase";
import { captureClientError } from "@/services/clientLogger";

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  requireAuth?: boolean;
};

async function readFunctionError(error: unknown) {
  const context = error && typeof error === "object" && "context" in error
    ? (error as { context?: unknown }).context
    : null;

  if (context && typeof context === "object" && "clone" in context && typeof (context as Response).clone === "function") {
    try {
      const response = (context as Response).clone();
      const text = await response.text();
      return {
        status: response.status,
        body: text.slice(0, 2000)
      };
    } catch {
      return null;
    }
  }

  return null;
}

export async function callFunction<T>(name: string, options: ApiOptions = {}): Promise<T> {
  const query = options.query
    ? `?${new URLSearchParams(Object.entries(options.query).filter((entry): entry is [string, string | number] => entry[1] !== undefined).map(([key, value]) => [key, String(value)])).toString()}`
    : "";
  const requireAuth = options.requireAuth ?? true;
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (requireAuth && !accessToken) {
    throw { error: "unauthenticated" };
  }

  const { data, error } = await supabase.functions.invoke(`${name}${query}`, {
    method: options.method ?? "POST",
    body: options.body as Record<string, unknown> | undefined,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  });

  if (error) {
    const errorContext = await readFunctionError(error);
    captureClientError("edge_function_error", error, { functionName: name, method: options.method ?? "POST", errorContext });
    throw error;
  }
  if (data && typeof data === "object" && "error" in data) {
    captureClientError("edge_function_response_error", data, { functionName: name, method: options.method ?? "POST" });
    throw data;
  }
  return data as T;
}
