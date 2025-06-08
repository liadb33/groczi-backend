const GOOGLE_GEOCODING_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_GEOCODING_BASE_URL = process.env.GOOGLE_GEOCODING_BASE_URL;

export async function fetchCoordinates(
  query: string
): Promise<{ lat: number; lon: number } | null> {
  const url = `${GOOGLE_GEOCODING_BASE_URL}?address=${encodeURIComponent(
    query
  )}&key=${GOOGLE_GEOCODING_API_KEY}&language=iw`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" || !data.results.length) {
      console.warn(`Google Geocoding failed for "${query}": ${data.status}`);
      return null;
    }

    const result = data.results[0];
    const { geometry } = result;
    const { lat, lon } = geometry.location;

    return { lat, lon };
  } catch (err) {
    console.error(`Google Geocoding error for "${query}":`, err);
    return null;
  }
}
