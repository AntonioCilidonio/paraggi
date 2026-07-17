export type FeedSortField = "date" | "distance";
export type FeedSortDirection = "asc" | "desc";

type SortablePost = {
  id: string;
  created_at: string;
  distance_meters: number | null;
};

export function sortFeedPosts<T extends SortablePost>(
  posts: T[],
  field: FeedSortField,
  direction: FeedSortDirection,
) {
  return [...posts].sort((left, right) => {
    if (field === "distance" && (left.distance_meters === null || right.distance_meters === null)) {
      if (left.distance_meters !== right.distance_meters) {
        return left.distance_meters === null ? 1 : -1;
      }
    }
    const comparison = field === "date"
      ? new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
      : (left.distance_meters ?? 0) - (right.distance_meters ?? 0);
    if (comparison === 0) return left.id.localeCompare(right.id);
    return direction === "asc" ? comparison : -comparison;
  });
}
