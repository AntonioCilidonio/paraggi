import { getLocationLabels } from "./locationLabels";

describe("getLocationLabels", () => {
  it("uses the city before an Android civic number", () => {
    expect(getLocationLabels({ name: "43a", city: "Reggio Emilia" })).toEqual({
      areaName: "Reggio Emilia",
      city: "Reggio Emilia",
      placeLabel: undefined
    });
  });

  it("prefers a useful district and keeps the street only as detail", () => {
    expect(getLocationLabels({ district: "Centro storico", city: "Bologna", street: "Via Rizzoli" })).toEqual({
      areaName: "Centro storico",
      city: "Bologna",
      placeLabel: "Via Rizzoli, Centro storico"
    });
  });
});
