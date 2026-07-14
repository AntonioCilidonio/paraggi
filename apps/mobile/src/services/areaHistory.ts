export type AreaHistory = {
  id: string;
  area_id: string;
  first_seen_at: string;
  last_seen_at: string;
  post_count: number;
  comment_count: number;
  connection_count: number;
  areas: { name: string; city: string | null; country_code: string } | null;
};

function areaIdentity(item: AreaHistory) {
  const name = item.areas?.name?.trim().toLocaleLowerCase("it-IT") ?? "area";
  const city = item.areas?.city?.trim().toLocaleLowerCase("it-IT") ?? "";
  return `${name}|${city}|${item.areas?.country_code ?? "IT"}`;
}

export function deduplicateAreas(items: AreaHistory[]) {
  const unique = new Map<string, AreaHistory>();
  for (const item of items) {
    const key = areaIdentity(item);
    const current = unique.get(key);
    if (!current) {
      unique.set(key, item);
      continue;
    }
    unique.set(key, {
      ...current,
      first_seen_at: current.first_seen_at < item.first_seen_at ? current.first_seen_at : item.first_seen_at,
      last_seen_at: current.last_seen_at > item.last_seen_at ? current.last_seen_at : item.last_seen_at,
      post_count: current.post_count + item.post_count,
      comment_count: current.comment_count + item.comment_count,
      connection_count: current.connection_count + item.connection_count
    });
  }
  return [...unique.values()].sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
}
