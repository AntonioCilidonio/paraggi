import { audit, jsonResponse, readJson, requireUser, withHttp } from "../_shared/http.ts";

type Payload = {
  commentId?: string;
  rating?: -1 | 1;
};

Deno.serve(await withHttp(async (req) => {
  const { user, adminClient } = await requireUser(req);
  const payload = await readJson<Payload>(req);
  if (!payload.commentId || ![-1, 1].includes(payload.rating ?? 0)) {
    return jsonResponse({ error: "invalid_comment_rating" }, 400);
  }

  const { data, error } = await adminClient.rpc("rate_comment", {
    comment_id_input: payload.commentId,
    rater_id_input: user.id,
    rating_input: payload.rating
  }).single();

  if (error) {
    const knownError = [
      "invalid_comment_rating",
      "comment_not_found",
      "post_not_found",
      "comment_rating_not_allowed",
      "cannot_rate_own_comment"
    ].find((code) => error.message.includes(code));
    return jsonResponse({ error: knownError ?? "comment_rating_failed" }, knownError ? 403 : 400);
  }

  await audit(adminClient, {
    actorId: user.id,
    eventType: "comment",
    action: payload.rating === 1 ? "comment_rating_up" : "comment_rating_down",
    targetTable: "comments",
    targetId: payload.commentId,
    metadata: { reputationDelta: data.reputation_delta }
  });

  return jsonResponse({
    rating: data.applied_rating,
    reputationScore: data.reputation_score,
    reputationDelta: data.reputation_delta
  });
}));
