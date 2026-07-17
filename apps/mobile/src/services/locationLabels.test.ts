import { formatAreaCityLabel, getLocationLabels } from "./locationLabels";

describe("formatAreaCityLabel", () => {
  it("does not repeat the city when area and city match", () => {
    expect(formatAreaCityLabel("Reggio Emilia", "reggio emilia")).toBe("Reggio Emilia");
    expect(formatAreaCityLabel("Reggiolo", "Reggiolo")).toBe("Reggiolo");
  });

  it("keeps distinct area and city names", () => {
    expect(formatAreaCityLabel("Centro storico", "Bologna")).toBe("Centro storico, Bologna");
  });
});

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

  it("does not use an iOS macro-area as the city", () => {
    expect(getLocationLabels({ subregion: "Nord-Est", district: "Reggio Emilia", region: "Emilia-Romagna" })).toEqual({
      areaName: "Reggio Emilia",
      city: "Reggio Emilia",
      placeLabel: "Reggio Emilia"
    });
  });

  it("ignores a macro-area even when iOS reports it as the district", () => {
    expect(getLocationLabels({ district: "Nord-Est", name: "Reggio Emilia", region: "Emilia-Romagna" })).toEqual({
      areaName: "Reggio Emilia",
      city: "Reggio Emilia",
      placeLabel: undefined
    });
  });
});
