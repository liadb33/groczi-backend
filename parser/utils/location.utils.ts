import { knownCities } from "../constants/cities.contants.js";

const apiKey = process.env.GOOGLE_API_KEY;
const baseUrl = "https://maps.googleapis.com/maps/api/geocode/json";

export function cleanAddressPart(value: any): string | null {
  if (typeof value !== "string") return null; // <— וידוא שהקלט הוא string
  const str = value.trim();
  if (str.toLowerCase() === "unknown") return null;
  if (!str) return null;
  return str
    .replace(/[^א-ת0-9\s.,\/]/gu, "") // מסיר תווים לא תקניים
    .replace(/\s{2,}/g, " ") // מסיר רווחים כפולים
    .trim();
}

function extractFromStoreName(storename: string | null): { address?: string, city?: string, zipcode?: string } {
  if (!storename) return {};

  const foundCity = knownCities.find(city => storename.includes(city));

  const zipcodeMatch = storename.match(/\b\d{5,7}\b/);
  const zipcode = zipcodeMatch ? zipcodeMatch[0] : undefined;


  let address = storename;

  if (foundCity) address = address.replace(foundCity, "");

  if (zipcode) address = address.replace(zipcode, "");

  address = address.replace(/\bישראל\b/g, "");

  address = address.replace(/\s{2,}/g, " ").trim();

  return {
    city: foundCity,
    address: address || undefined,
    zipcode
  };
}


type GeocodeResult = {
  address: string;
  city: string;
  lat: number;
  lon: number;
  zipcode: string | null;
};

export async function fetchCoordinates(
  addressQuery: string
): Promise<GeocodeResult | null> {
  const url = `${baseUrl}?address=${encodeURIComponent(
    addressQuery
  )}&key=${apiKey}&language=iw`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" || !data.results.length) {
      console.warn(
        `Google Geocoding failed for "${addressQuery}": ${data.status}`
      );
      return null;
    }

    const result = data.results[0];
    const { formatted_address, address_components, geometry } = result;
    const { lat, lng: lon } = geometry.location;
    const cityComp =
      address_components.find((c: any) => c.types.includes("locality")) ||
      address_components.find((c: any) =>
        c.types.includes("administrative_area_level_2")
      );

    const city = cityComp?.long_name ?? null;

    return {
      address: formatted_address,
      city,
      lat,
      lon,
      zipcode: null,
    };
  } catch (err) {
    console.error(`Google Geocoding error for "${addressQuery}":`, err);
    return null;
  }
}


export async function handleLocation(input: Record<string, any>) {
  let address = cleanAddressPart(input["address"]);
  let city = cleanAddressPart(input["city"]);
  let zipcode = cleanAddressPart(input["zipcode"]);
  const storename = cleanAddressPart(input["storename"]);

  if ((!city || !address || !zipcode) && storename) {
    const extracted = extractFromStoreName(storename);
    if (!city && extracted.city) city = extracted.city;
    if (!address && extracted.address) address = extracted.address;
    if (!zipcode && extracted.zipcode) zipcode = extracted.zipcode;
  }

  const queryOptions = [
    address && city && `${address} ${city} ${zipcode ?? ""}`,
    storename && address && `${storename} ${address}`,
    storename && city && `${storename} ${city}`,
    storename,
  ].filter(Boolean) as string[];

  for (const query of queryOptions) {
    const location = await fetchCoordinates(query);
    if (location) {
      console.log("✅ Found:", location.lat, location.lon, "FOR:", query);
      return {
        address: location.address,
        city: location.city,
        zipcode,
        storename,
        lat: location.lat,
        lon: location.lon,
      };
    } else {
      console.warn("❌ Failed:", query);
    }
  }

  return {
    storename,
    address,
    city,
    zipcode,
    lat: null,
    lon: null,
  };
}