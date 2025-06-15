import { OpenAI } from "openai";
import { storePrompt,groceryPrompt } from "../constants/prompts.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper function to extract JSON from markdown code blocks
function extractJsonFromResponse(response: string): string {
  // Remove markdown code blocks if present
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  // If no code blocks, return the original response
  return response.trim();
}


// Simple OpenAI request function
async function makeOpenAIRequest(messages: any[], temperature: number): Promise<string> {
  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages,
    temperature,
  });
  
  return chatCompletion.choices[0].message.content || "{}";
}

export async function fixStoreData(data: {
  storename: string;
  address: string;
  city: string;
  chainname: string;
  subchainname: string;
}) {
  const prompt =
    storePrompt + `\nהנה האובייקט:\n${JSON.stringify(data, null, 2)}`;

  const response = await makeOpenAIRequest([{ role: "user", content: prompt }], 0);
  const cleanJson = extractJsonFromResponse(response);
  return JSON.parse(cleanJson);
}

export async function fixProductData(data: {
  itemName: string;
  unitQty: string | null;
  manufactureName?: string | null;
}) {
  const prompt =
    groceryPrompt + `\nהנה האובייקט:\n${JSON.stringify(data, null, 2)}`;

  const response = await makeOpenAIRequest([{ role: "user", content: prompt }], 0.2);
  const cleanJson = extractJsonFromResponse(response);
  return JSON.parse(cleanJson);
}
