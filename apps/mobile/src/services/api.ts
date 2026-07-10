import { supabase } from "@/services/supabase";
import { captureClientError } from "@/services/clientLogger";

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

export async function callFunction<T>(name: string, options: ApiOptions = {}): Promise<T> {
  const query = options.query
    ? `?${new URLSearchParams(Object.entries(options.query).filter((entry): entry is [string, string | number] => entry[1] !== undefined).map(([key, value]) => [key, String(value)])).toString()}`
    : "";

  const { data, error } = await supabase.functions.invoke(`${name}${query}`, {
    method: options.method ?? "POST",
    body: options.body as Record<string, unknown> | undefined
  });

  if (error) {
    captureClientError("edge_function_error", error, { functionName: name, method: options.method ?? "POST" });
    throw error;
  }
  if (data && typeof data === "object" && "error" in data) {
    captureClientError("edge_function_response_error", data, { functionName: name, method: options.method ?? "POST" });
    throw data;
  }
  return data as T;
}
