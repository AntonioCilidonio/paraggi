import type { AdminClient } from "./http.ts";

export type PostAttachment = {
  id: string;
  post_id: string;
  kind: "image" | "video" | "audio" | "location";
  storage_path: string | null;
  mime_type: string | null;
  duration_seconds: number | null;
  label: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  url: string | null;
};

export async function getPostAttachments(adminClient: AdminClient, postIds: string[]) {
  if (postIds.length === 0) return new Map<string, PostAttachment[]>();

  const { data, error } = await adminClient.rpc("get_post_attachments_for_posts", {
    post_ids_input: postIds
  });
  if (error) throw error;

  const attachments = await Promise.all((data ?? []).map(async (row) => {
    let url: string | null = null;
    if (row.storage_path) {
      const signed = await adminClient.storage.from("post-media").createSignedUrl(row.storage_path, 60 * 60);
      if (!signed.error) url = signed.data.signedUrl;
    }
    return { ...row, url } as PostAttachment;
  }));

  const byPost = new Map<string, PostAttachment[]>();
  for (const attachment of attachments) {
    byPost.set(attachment.post_id, [...(byPost.get(attachment.post_id) ?? []), attachment]);
  }
  return byPost;
}
