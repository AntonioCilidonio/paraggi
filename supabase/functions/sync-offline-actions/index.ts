import { jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type OfflineAction = {
  id: string;
  type: "create-post" | "create-comment" | "send-private-message";
  payload: Record<string, unknown>;
};

Deno.serve(await withHttp(async (req) => {
  await requireUser(req);
  const payload = await readJson<{ actions: OfflineAction[] }>(req);

  return jsonResponse({
    results: payload.actions.map((action) => ({
      id: action.id,
      status: "rejected",
      reason: "offline_sync_router_pending_backend_step",
      retryable: false
    }))
  });
}));

