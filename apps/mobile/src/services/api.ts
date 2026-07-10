import { supabase } from "@/services/supabase";

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

  if (error) throw error;
  if (data && typeof data === "object" && "error" in data) throw data;
  return data as T;
}
