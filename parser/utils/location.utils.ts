


const apiKey = process.env.GOOGLE_API_KEY;
const baseUrl = "https://maps.googleapis.com/maps/api/geocode/json";

function cleanAddressPart(str: string): string|null {
    if (typeof str !== 'string')
        str = String(str ?? ''); // הופך undefined/null ל־'' וממיר כל דבר למחרוזת
    if(str.toLocaleLowerCase()==="unknown") return null;

    return str
        .replace(/[^\p{L}\p{N}\s.,-]/gu, '') // מסיר תווים לא תקניים כמו @, # וכו'
        .replace(/\s{2,}/g, ' ') // מסיר רווחים כפולים
        .trim();
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export async function fetchCoordinates(address: string): Promise<{ lat: number, lon: number } | null> {
  const url = `${baseUrl}?address=${encodeURIComponent(address)}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK") {
      console.warn(`Google Geocoding failed for "${address}": ${data.status}`);
      return null;
    }

    const location = data.results[0].geometry.location;
    return { lat: location.lat, lon: location.lng };
  } catch (err) {
    console.error(`Google Geocoding error for "${address}":`, err);
    return null;
  }
}

export async function handleLocation(input: Record<string, any>) {
    const address = cleanAddressPart(input["address"]);
    const city = cleanAddressPart(input["city"]);
    const zipcode = cleanAddressPart(input["zipcode"]);
    const storename = cleanAddressPart(input["storename"]);

    const fullAddress = `${address} ${city} ${zipcode}`;
    const fallbackAddress = `${storename} ${city}`;
    
    let location = await fetchCoordinates(fullAddress);

    if (!location) {
        console.warn(`🔁 Retrying with fallback address: ${fallbackAddress}`);
        location = await fetchCoordinates(fallbackAddress);
    }

    if (location) {
        console.log("✅ Found:", location.lat, location.lon,"FOR:", fullAddress);
        return {...location, address: fullAddress, city: city, zipcode: zipcode, storename: storename};
    } else {
        console.error("❌ Unable to geocode:", fullAddress);
    }
}