import type { PostAttachment } from "@/components/PostAttachments";

const attachmentUrls = new Map<string, string>();

export function stabilizeAttachmentUrls(attachments?: PostAttachment[]) {
  return attachments?.map((attachment) => {
    if (!attachment.url) return attachment;
    const cachedUrl = attachmentUrls.get(attachment.id);
    if (cachedUrl) return { ...attachment, url: cachedUrl };
    attachmentUrls.set(attachment.id, attachment.url);
    return attachment;
  });
}

export function stabilizePostAttachments<T extends { attachments?: PostAttachment[] }>(post: T): T {
  return { ...post, attachments: stabilizeAttachmentUrls(post.attachments) };
}
