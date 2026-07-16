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

export function normalizeAreaHistory(value: unknown): AreaHistory[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AreaHistory => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<AreaHistory>;
    return typeof candidate.id === "string" &&
      typeof candidate.area_id === "string" &&
      typeof candidate.first_seen_at === "string" &&
      typeof candidate.last_seen_at === "string";
  }).map((item) => ({
    ...item,
    post_count: Number.isFinite(Number(item.post_count)) ? Number(item.post_count) : 0,
    comment_count: Number.isFinite(Number(item.comment_count)) ? Number(item.comment_count) : 0,
    connection_count: Number.isFinite(Number(item.connection_count)) ? Number(item.connection_count) : 0,
    areas: item.areas && typeof item.areas === "object" && !Array.isArray(item.areas)
      ? item.areas
      : null,
  }));
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
