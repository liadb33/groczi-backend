import { OpenAI } from "openai";

const GOOGLE_GEOCODING_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_GEOCODING_BASE_URL = process.env.GOOGLE_GEOCODING_BASE_URL;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function fixStoreData(data: {
  storename: string;
  address: string;
  city: string;
  zipcode: string;
  chainname: string;
  subchainname: string;
}) {
  const prompt = `אתה מקבל אובייקט JSON המכיל מידע על חנות אך הערכים שלו מבולגנים בין השדות. תסדר את הערכים של השדות הבאים בלבד: "storename", "address", "city", "zipcode". התוצאה צריכה להיות JSON בלבד בלי מילים נוספות. הנה האובייקט:
${JSON.stringify(data, null, 2)}`;

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  const response = chatCompletion.choices[0].message.content || "{}";
  return JSON.parse(response);
}

export async function fixProductData(data: {
  itemName: string;
  manufactureName?: string | null;
}) {
  const categoryList = categories.join(", ");

  const prompt = `יש לך מוצר עם itemName ו-manufactureName (אולי null). 
תסדר את השם של המוצר שיהיה ברור ונקי, תוודא שה-manufactureName נכון (אם אין אז null), ותפלוט את הקטגוריה המתאימה מתוך הרשימה: [${categoryList}].
התוצאה חייבת להיות JSON בפורמט:
{
  "itemName": string,
  "manufactureName": string | null,
  "category": string
}
הנה המידע:
${JSON.stringify(data, null, 2)}`;

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const response = chatCompletion.choices[0].message.content || "{}";
  return JSON.parse(response);
}

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
