import { OpenAI } from "openai";
import { storePrompt, groceryPrompt, groceryBatchPrompt } from "../constants/prompts.js";

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

// Enhanced OpenAI request function with error handling and retry logic
async function makeOpenAIRequest(messages: any[], temperature: number, maxRetries: number = 3): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages,
        temperature,
      });
      
      return chatCompletion.choices[0].message.content || "{}";
    } catch (error: any) {
      console.log(`❌ OpenAI API Error (attempt ${attempt}/${maxRetries}):`, error.message);
      
      // Handle rate limiting specifically
      if (error.status === 429) {
        const waitTime = error.headers?.['retry-after-ms'] 
          ? parseInt(error.headers['retry-after-ms']) 
          : Math.min(1000 * Math.pow(2, attempt), 60000); // Exponential backoff, max 60s
        
        console.log(`⏳ Rate limited. Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Continue to next retry attempt
        if (attempt < maxRetries) continue;
      }
      
      // For other errors or final attempt, log and return empty object
      console.log(`❌ Error: ${error}`);
      if (attempt === maxRetries) {
        console.log(`❌ Failed after ${maxRetries} attempts. Skipping this request.`);
        return "{}"; // Return empty JSON to continue processing
      }
    }
  }
  
  return "{}"; // Fallback return
}

export async function fixStoreData(data: {
  storename: string;
  address: string;
  city: string;
  chainname: string;
  subchainname: string;
}) {
  try {
    const prompt =
      storePrompt + `\nהנה האובייקט:\n${JSON.stringify(data, null, 2)}`;

    const response = await makeOpenAIRequest([{ role: "user", content: prompt }], 0);
    const cleanJson = extractJsonFromResponse(response);
    return JSON.parse(cleanJson);
  } catch (error) {
    console.log(`❌ Failed to fix store data:`, error);
    return data; // Return original data if AI fails
  }
}

export async function fixProductData(data: {
  itemName: string;
  unitQty: string | null;
  manufactureName?: string | null;
}) {
  try {
    const prompt =
      groceryPrompt + `\nהנה האובייקט:\n${JSON.stringify(data, null, 2)}`;

    const response = await makeOpenAIRequest([{ role: "user", content: prompt }], 0.2);
    const cleanJson = extractJsonFromResponse(response);
    return JSON.parse(cleanJson);
  } catch (error) {
    console.log(`❌ Failed to fix product data for ${data.itemName}:`, error);
    return {
      itemName: data.itemName,
      manufactureName: data.manufactureName,
      unitQty: data.unitQty,
      category: null
    }; // Return original data with null category if AI fails
  }
}

export async function fixProductDataBatch(batchData: {
  itemCode: string;
  itemName: string;
  unitQty: string | null;
  manufactureName?: string | null;
}[]): Promise<{
  itemCode: string;
  itemName: string;
  manufactureName: string | null;
  unitQty: string | null;
  category: string | null;
}[]> {
  if (batchData.length === 0) return [];
  
  try {
    console.log(`🔄 Processing batch of ${batchData.length} items with AI...`);
    
    const prompt = groceryBatchPrompt + `\nהנה המערך של אובייקטים:\n${JSON.stringify(batchData, null, 2)}`;

    const response = await makeOpenAIRequest([{ role: "user", content: prompt }], 0.2);
    const cleanJson = extractJsonFromResponse(response);
    const results = JSON.parse(cleanJson);
    
    // Validate response is array and has correct length
    if (!Array.isArray(results)) {
      console.log(`❌ Batch response is not an array, falling back to individual processing`);
      throw new Error("Response is not an array");
    }
    
    if (results.length !== batchData.length) {
      console.log(`⚠️ Batch response length mismatch: expected ${batchData.length}, got ${results.length}`);
    }
    
    // Ensure all items have itemCode and map results back
    const processedResults = batchData.map((originalItem, index) => {
      const aiResult = results[index] || {};
      return {
        itemCode: originalItem.itemCode,
        itemName: aiResult.itemName || originalItem.itemName,
        manufactureName: aiResult.manufactureName || originalItem.manufactureName || null,
        unitQty: aiResult.unitQty || originalItem.unitQty || null,
        category: aiResult.category || "אחר"
      };
    });
    
    console.log(`✅ Batch processed successfully: ${processedResults.length} items`);
    return processedResults;
    
  } catch (error) {
    console.log(`❌ Batch processing failed for ${batchData.length} items:`, error);
    
    // Fallback: return original data with "אחר" categories
    return batchData.map(item => ({
      itemCode: item.itemCode,
      itemName: item.itemName,
      manufactureName: item.manufactureName || null,
      unitQty: item.unitQty || null,
      category: "אחר"
    }));
  }
}
