import { console } from "inspector";

const apiKey = process.env.GOOGLE_API_KEY;
const baseUrl = "https://maps.googleapis.com/maps/api/geocode/json";

export function cleanAddressPart(value: unknown): string | null {
  if (typeof value !== "string") return null; // <— וידוא שהקלט הוא string
  const str = value.trim();
  if (str.toLowerCase() === "unknown") return null;
  if (!str) return null;
  return str
    .replace(/[^\p{L}\p{N}\s.,-]/gu, "") // מסיר תווים לא תקניים
    .replace(/\s{2,}/g, " ") // מסיר רווחים כפולים
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GeocodeResult = {
  address: string;
  city: string | null;
  lat: number;
  lon: number;
  zipcode: string | null;
};

export async function fetchCoordinates(
  addressQuery: string
): Promise<GeocodeResult | null> {
  console.log("Fetching coordinates for:", addressQuery);
  const url = `${baseUrl}?address=${encodeURIComponent(
    addressQuery
  )}&key=${apiKey}`;

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

    // חיפוש רכיב העיר (locality) או חלופה (administrative_area_level_2)
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

//const query = encodeURIComponent(store.storeName + ' ישראל');
//const url   = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${API_KEY}`;

export async function handleLocation(input: Record<string, any>) {
  const address = cleanAddressPart(input["address"]);
  const city = cleanAddressPart(input["city"]);
  const zipcode = cleanAddressPart(input["zipcode"]);
  const storename = cleanAddressPart(input["storename"]);
  console.log("input:");
  if (address && city) {
    const query = storename?.includes(city)
      ? `${storename} ${address} `
      : `${storename} ${address} ${city}`;
    const location = await fetchCoordinates(encodeURIComponent(query));
    if (location) {
      console.log(
        "✅ 1 - Found:",
        location.lat,
        location.lon,
        "FOR:",
        `${address} ${city} `
      );
      return {
        address: location.address,
        city: location.city,
        zipcode,
        storename,
      };
    } else {
      console.error("❌ Unable to geocode:", `${address} ${city} ${zipcode}`);
    }
  }
  if (!address && city) {
    const query = storename?.includes(city)
      ? storename
      : `${storename} ${city}`;
    const location = await fetchCoordinates(encodeURIComponent(query));
    if (location) {
      console.log(
        "✅ 2 - Found:",
        location.lat,
        location.lon,
        "FOR:",
        `${city} ${zipcode}`
      );
      return { ...location, zipcode, storename };
    } else {
      console.error("❌ Unable to geocode:", `${city} ${zipcode}`);
    }
  }
  if (address && !city) {
    const query = `${storename} ${address}`;
    const location = await fetchCoordinates(encodeURIComponent(query));
    if (location) {
      console.log(
        "✅ 3 - Found:",
        location.lat,
        location.lon,
        "FOR:",
        `${address}`
      );
      return { ...location, address, zipcode, storename };
    } else {
      console.error("❌ Unable to geocode:", `${address}`);
    }
  }
  if (!storename) return null;
  const location = await fetchCoordinates(encodeURIComponent(storename));
  if (location) {
    console.log("✅ 4 - Found:", location.lat, location.lon, "FOR:", storename);
    return { ...location, zipcode, storename };
  } else {
    console.error("❌ Unable to geocode:", storename);
  }
}
