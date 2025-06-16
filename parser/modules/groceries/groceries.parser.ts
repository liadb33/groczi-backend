import { XMLParser } from "fast-xml-parser";
import { GroceryReference } from "./grocery.entity.js";
import { parseXmlFile } from "../../utils/xml-parser.utils.js";
import { 
  mapToGroceryAndReference, 
  extractItemDataForAI, 
  mapToGroceryWithAIData 
} from "./groceries.mapper.js";
// import { fixProductDataBatch } from "../../utils/openai.utils.js";
import { findGroceriesBulk } from "../../repositories/groceries.repository.js";
import {
  ensureArray,
  getIdsFromRoot,
  logUnrecognizedFormat,
} from "../../utils/general.utils.js";

const parser = new XMLParser({ ignoreAttributes: false });

export async function parseGroceryXmlFile(
  filePath: string
): Promise<GroceryReference[]> {
  const json = await parseXmlFile(filePath, parser);
  if (!json) {
    console.log("Error in groceries : parsing file:", filePath);
    return [];
  }

  const dataRoot: any = json.root ?? json.Root;
  if (!dataRoot) return [];

  const xmlChainRaw = dataRoot.ChainId ?? dataRoot.ChainID ?? "";
  const xmlSubRaw = dataRoot.SubChainId ?? dataRoot.SubChainID ?? "";
  const xmlStoreRaw = dataRoot.StoreId ?? dataRoot.StoreID ?? "";

  const { chainId, storeId, subChainId } = await getIdsFromRoot(
    xmlChainRaw,xmlStoreRaw,xmlSubRaw,
    filePath
  );

  if (subChainId === null) return [];

  const arr = ensureArray(dataRoot.Items?.Item);

  // Extract all itemCodes at once
  const allItemCodes = arr.map(item => {
    const enhancedItem = { ...item, chainId, subChainId, storeId };
    return extractItemDataForAI(enhancedItem).itemCode;
  });

  // Single bulk database query (replaces individual findGrocery calls)
  const existingGroceries = await findGroceriesBulk(allItemCodes);
  const existingCodesSet = new Set(
    existingGroceries
      .filter(g => g.category) // Only items with categories
      .map(g => g.itemCode)
  );

  // Step 2: Separate items based on bulk lookup results
  const itemsFromDB: any[] = [];
  const itemsNeedingAI: any[] = [];

  for (const item of arr) {
    const enhancedItem = { ...item, chainId, subChainId, storeId };
    const itemCode = extractItemDataForAI(enhancedItem).itemCode;
    
    if (existingCodesSet.has(itemCode)) {
      itemsFromDB.push(enhancedItem);
    } else {
      itemsNeedingAI.push(enhancedItem);
    }
  }

  // Step 3: Process database items normally
  const dbItemsPromises = itemsFromDB.map(item => mapToGroceryAndReference(item));
  const dbResults = await Promise.all(dbItemsPromises);

  // Step 4: COMMENTED OUT - Process AI items with controlled parallel batches
  // TODO: Re-enable this section later to process items that need AI enhancement
  /*
  const BATCH_SIZE = 60; // Increased from 25 (more items per request)
  const MAX_CONCURRENT_BATCHES = 7; // Control concurrent requests to stay within rate limits
  const DELAY_BETWEEN_BATCHES = 50; // 200ms delay to avoid rate limits
  
  const aiResults: (GroceryReference | null)[] = [];

  if (itemsNeedingAI.length > 0) {
    // Create all batches
    const batches = [];
    for (let i = 0; i < itemsNeedingAI.length; i += BATCH_SIZE) {
      batches.push(itemsNeedingAI.slice(i, i + BATCH_SIZE));
    }

    console.log(`🚀 Processing ${batches.length} batches with max ${MAX_CONCURRENT_BATCHES} concurrent (${BATCH_SIZE} items per batch)`);
    
    let lastRequestTime = 0;

    // Rate-limited batch processing function
    const processWithRateLimit = async (batchDataForAI: any[]) => {
      // Ensure minimum delay between requests
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      const MIN_DELAY = 150; // Minimum 150ms between requests
      
      if (timeSinceLastRequest < MIN_DELAY) {
        await new Promise(resolve => 
          setTimeout(resolve, MIN_DELAY - timeSinceLastRequest)
        );
      }
      
      lastRequestTime = Date.now();
      return await fixProductDataBatch(batchDataForAI);
    };

    // Process batches in controlled parallel groups
    for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
      const concurrentBatches = batches.slice(i, i + MAX_CONCURRENT_BATCHES);
      
      const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
        const globalBatchIndex = i + batchIndex + 1;
        console.log(`🔄 Processing batch ${globalBatchIndex}/${batches.length} (${batch.length} items)`);
        
        // Add small delay to avoid hitting rate limits
        if (batchIndex > 0) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
        
        try {
          const batchDataForAI = batch.map(item => extractItemDataForAI(item));
          const aiEnhancedData = await processWithRateLimit(batchDataForAI);
          
          const batchResults = await Promise.all(
            batch.map(async (originalItem, index) => {
              const aiData = aiEnhancedData[index];
              if (aiData) {
                console.log(`🤖 AI enhanced: ${aiData.itemName} (${aiData.category || 'no category - other'})`);
                return await mapToGroceryWithAIData(originalItem, aiData);
              }
              return null;
            })
          );
          
          return batchResults;
        } catch (error) {
          console.error(`❌ Batch ${globalBatchIndex} failed:`, error);
          // Return nulls for failed batch items
          return batch.map(() => null);
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      aiResults.push(...batchResults.flat());
      
      // Progress update
      const processedBatches = Math.min(i + MAX_CONCURRENT_BATCHES, batches.length);
      console.log(`✅ Completed ${processedBatches}/${batches.length} batches`);
    }
  }
  */

  // Step 4 ALTERNATIVE: Process items that need AI without AI for now (just basic processing)
  const aiResults: (GroceryReference | null)[] = [];
  
  if (itemsNeedingAI.length > 0) {
    const noAiItemsPromises = itemsNeedingAI.map(item => mapToGroceryAndReference(item));
    const noAiResults = await Promise.all(noAiItemsPromises);
    aiResults.push(...noAiResults);
  }

  // Step 5: Combine results and filter out nulls
  const allResults = [...dbResults, ...aiResults];
  const items = allResults.filter((item): item is GroceryReference => item !== null);

  if (!items) return logUnrecognizedFormat(filePath, "groceries.parser.ts");

  console.log(`🎉 Successfully processed ${items.length} items (${itemsFromDB.length} from DB, ${aiResults.filter(r => r !== null).length} without AI enhancement)`);

  return items;
}
