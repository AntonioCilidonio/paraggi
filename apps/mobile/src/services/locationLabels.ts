type GeocodedPlace = {
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
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

function isBroadItalianArea(value: string | null, region?: string | null) {
  if (!value) return false;
  if (region && value.localeCompare(region, "it-IT", { sensitivity: "base" }) === 0) return true;
  return /^(nord[- ]?(est|ovest)|centro|sud|isole)$/i.test(value)
    || /^(abruzzo|basilicata|calabria|campania|emilia[- ]romagna|friuli[- ]venezia giulia|lazio|liguria|lombardia|marche|molise|piemonte|puglia|sardegna|sicilia|toscana|trentino[- ]alto adige|umbria|valle d'aosta|veneto)$/i.test(value);
}

export function formatAreaCityLabel(areaName?: string | null, cityName?: string | null) {
  const area = clean(areaName) ?? "Area vicina";
  const city = clean(cityName);
  if (!city || area.localeCompare(city, "it-IT", { sensitivity: "base" }) === 0) return area;
  return `${area}, ${city}`;
}

export function getLocationLabels(place?: GeocodedPlace | null) {
  const nativeName = clean(place?.name);
  const region = clean(place?.region);
  const rawDistrict = clean(place?.district);
  const district = isUsefulPlaceName(rawDistrict) && !isBroadItalianArea(rawDistrict, region) ? rawDistrict : null;
  const localityCandidates = [clean(place?.city), district, clean(place?.subregion), nativeName];
  const city = localityCandidates.find((candidate) => isUsefulPlaceName(candidate) && !isBroadItalianArea(candidate, region)) ?? null;
  const areaName = district ?? city ?? (isUsefulPlaceName(nativeName) ? nativeName : null) ?? "Area vicina";
  const placeLabel = [clean(place?.street), district].filter(Boolean).join(", ") || undefined;
  return { areaName, city: city ?? undefined, placeLabel };
}
