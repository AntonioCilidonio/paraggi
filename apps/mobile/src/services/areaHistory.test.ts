import { deduplicateAreas, normalizeAreaHistory, type AreaHistory } from "./areaHistory";

function area(overrides: Partial<AreaHistory>): AreaHistory {
  return {
    id: "history-1",
    area_id: "area-1",
    first_seen_at: "2026-07-10T08:00:00.000Z",
    last_seen_at: "2026-07-10T09:00:00.000Z",
    post_count: 0,
    comment_count: 0,
    connection_count: 0,
    areas: { name: "Reggiolo", city: "Reggiolo", country_code: "IT" },
    ...overrides
  };
}

describe("deduplicateAreas", () => {
  it("merges repeated places while preserving activity totals and visit range", () => {
    const result = deduplicateAreas([
      area({ id: "history-1", area_id: "area-1", post_count: 1 }),
      area({ id: "history-2", area_id: "area-2", first_seen_at: "2026-07-09T08:00:00.000Z", last_seen_at: "2026-07-11T09:00:00.000Z", comment_count: 2 })
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ post_count: 1, comment_count: 2, first_seen_at: "2026-07-09T08:00:00.000Z", last_seen_at: "2026-07-11T09:00:00.000Z" });
  });

  it("keeps distinct cities separate", () => {
    const result = deduplicateAreas([
      area({ id: "history-1" }),
      area({ id: "history-2", area_id: "area-2", areas: { name: "Centro", city: "Bologna", country_code: "IT" } })
    ]);

    expect(result).toHaveLength(2);
  });

  it("ignores malformed API rows and normalizes counters", () => {
    const result = normalizeAreaHistory([
      null,
      { unexpected: true },
      area({ post_count: Number.NaN, comment_count: 2 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ post_count: 0, comment_count: 2 });
  });
});
