import { sortFeedPosts } from "./feedSorting";

const posts = [
  { id: "middle", created_at: "2026-07-16T10:00:00Z", distance_meters: 500 },
  { id: "new", created_at: "2026-07-17T10:00:00Z", distance_meters: 900 },
  { id: "old", created_at: "2026-07-15T10:00:00Z", distance_meters: 100 },
  { id: "unknown", created_at: "2026-07-14T10:00:00Z", distance_meters: null },
];

describe("sortFeedPosts", () => {
  it("sorts by publication date in both directions", () => {
    expect(sortFeedPosts(posts, "date", "desc").map((post) => post.id)).toEqual(["new", "middle", "old", "unknown"]);
    expect(sortFeedPosts(posts, "date", "asc").map((post) => post.id)).toEqual(["unknown", "old", "middle", "new"]);
  });

  it("sorts by distance and keeps unknown distances last", () => {
    expect(sortFeedPosts(posts, "distance", "asc").map((post) => post.id)).toEqual(["old", "middle", "new", "unknown"]);
    expect(sortFeedPosts(posts, "distance", "desc").map((post) => post.id)).toEqual(["new", "middle", "old", "unknown"]);
  });
});
