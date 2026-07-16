import { getSafeDangerCoordinates } from "./dangerAlert";

describe("getSafeDangerCoordinates", () => {
  it("normalizes valid numeric and string coordinates", () => {
    expect(
      getSafeDangerCoordinates({ latitude: "44.698", longitude: 10.631 }),
    ).toEqual({ latitude: 44.698, longitude: 10.631 });
  });

  it("rejects missing, invalid and out-of-range coordinates", () => {
    expect(getSafeDangerCoordinates(null)).toBeNull();
    expect(
      getSafeDangerCoordinates({ latitude: Number.NaN, longitude: 10 }),
    ).toBeNull();
    expect(
      getSafeDangerCoordinates({ latitude: 95, longitude: 10 }),
    ).toBeNull();
    expect(
      getSafeDangerCoordinates({ latitude: 45, longitude: 190 }),
    ).toBeNull();
  });
});
