type GeocodedPlace = {
  city?: string | null;
  subregion?: string | null;
  district?: string | null;
  name?: string | null;
  street?: string | null;
};

function clean(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 1 ? normalized : null;
}

function isUsefulPlaceName(value: string | null) {
  return Boolean(value && /[a-zA-ZÀ-ÿ]{3}/.test(value) && !/^\d+[a-z]?$/i.test(value));
}

export function getLocationLabels(place?: GeocodedPlace | null) {
  const city = clean(place?.city) ?? clean(place?.subregion);
  const district = clean(place?.district);
  const nativeName = clean(place?.name);
  const areaName = district ?? city ?? (isUsefulPlaceName(nativeName) ? nativeName : null) ?? "Area vicina";
  const placeLabel = [clean(place?.street), district].filter(Boolean).join(", ") || undefined;
  return { areaName, city: city ?? undefined, placeLabel };
}
