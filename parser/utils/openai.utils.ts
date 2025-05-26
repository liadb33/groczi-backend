import { OpenAI } from "openai";
import { CATEGORIES } from "../constants/categories";
import { storePrompt } from "../constants/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function fixStoreData(data: {
  storename: string;
  address: string;
  city: string;
  zipcode: string;
  chainname: string;
  subchainname: string;
}) {
  const prompt =
    storePrompt + `\nהנה האובייקט:\n${JSON.stringify(data, null, 2)}`;

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
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
  const categoryList = CATEGORIES.join(", ");

  const prompt =
    storePrompt + `\nהנה האובייקט:\n${JSON.stringify(data, null, 2)}`;

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const response = chatCompletion.choices[0].message.content || "{}";
  return JSON.parse(response);
}

async () => {
  const object = {
    chainname: "Dor Alon",
    subchainname: "AM:PM",
    storename: "Am-pm פרנקל",
    address: "פרנקל 15",
    city: "5000",
    zipcode: "6608419",
  };
  const data = await fixStoreData(object);
  console.log(data);
};
