import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export type AdminClient = ReturnType<typeof createClient>;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

export function handleOptions(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
}

export function getSupabase(req: Request) {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false }
  });

  return { userClient, adminClient };
}

export async function requireUser(req: Request) {
  const { userClient, adminClient } = getSupabase(req);
  const { data, error } = await userClient.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, "unauthorized");
  }

  return { user: data.user, userClient, adminClient };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

export async function audit(adminClient: ReturnType<typeof createClient>, input: {
  actorId?: string;
  eventType: string;
  action: string;
  targetTable?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await adminClient.from("audit_logs").insert({
    actor_id: input.actorId,
    event_type: input.eventType,
    action: input.action,
    target_table: input.targetTable,
    target_id: input.targetId,
    metadata: input.metadata ?? {}
  });
}

export async function withHttp(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const options = handleOptions(req);
    if (options) return options;

    try {
      return await handler(req);
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse({ error: error.message, details: error.details }, error.status);
      }

      console.error(error);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  };
}
