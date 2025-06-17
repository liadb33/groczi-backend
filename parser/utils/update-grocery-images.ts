import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import prisma from '../prisma-client/prismaClient.js';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

interface OffImageData {
  code: string;
  image_url: string;
  image_small_url: string;
}

async function updateGroceryImages(tsvFilePath: string) {
  try {
    console.log('📸 Starting grocery images update...');
    
    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    let totalProcessed = 0;
    let isFirstLine = true;
    
    // Create batch array to process items in batches - larger batch size for better performance
    const batchSize = 1000;
    let currentBatch: OffImageData[] = [];
    
    // Create readline interface for streaming large file with larger buffer
    const fileStream = createReadStream(tsvFilePath, { 
      highWaterMark: 1024 * 1024 // 1MB buffer for faster reading
    });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity // Handle Windows line endings
    });
    
    console.log('📂 Streaming TSV file line by line...');
    
    // Process each line
    for await (const line of rl) {
      // Skip header row
      if (isFirstLine) {
        isFirstLine = false;
        continue;
      }
      
      const trimmedLine = line.trim();
      if (trimmedLine) {
        const [code, image_url, image_small_url] = trimmedLine.split('\t');
        if (code && image_url) {
          currentBatch.push({ code, image_url, image_small_url });
          
                     // Process batch when it reaches the batch size
           if (currentBatch.length >= batchSize) {
             const results = await processBatchConcurrent(currentBatch);
             updatedCount += results.updated;
             notFoundCount += results.notFound;
             errorCount += results.errors;
             totalProcessed += currentBatch.length;
             
             console.log(`🔄 Processed ${totalProcessed} items so far (Updated: ${updatedCount}, Not found: ${notFoundCount}, Errors: ${errorCount})`);
             
             currentBatch = []; // Reset batch
             // Removed delay for maximum speed
           }
        }
      }
    }
    
         // Process remaining items in the last batch
     if (currentBatch.length > 0) {
       const results = await processBatchConcurrent(currentBatch);
       updatedCount += results.updated;
       notFoundCount += results.notFound;
       errorCount += results.errors;
       totalProcessed += currentBatch.length;
     }
    
    console.log('\n📊 Final Summary:');
    console.log(`📋 Total items processed: ${totalProcessed}`);
    console.log(`✅ Successfully updated: ${updatedCount} items`);
    console.log(`⚠️  Items not found in database: ${notFoundCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('🎉 Grocery images update completed!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

async function processBatchConcurrent(batch: OffImageData[]): Promise<{updated: number, notFound: number, errors: number}> {
  let updated = 0;
  let notFound = 0;
  let errors = 0;
  
  // Process items concurrently in smaller chunks to avoid overwhelming the database
  const concurrencyLimit = 50; // Process 50 items at once
  const chunks = [];
  
  for (let i = 0; i < batch.length; i += concurrencyLimit) {
    chunks.push(batch.slice(i, i + concurrencyLimit));
  }
  
  for (const chunk of chunks) {
    const promises = chunk.map(async (item) => {
      try {
        // Check if grocery item exists and if imageUrl is different
        const existingGrocery = await prisma.grocery.findUnique({
          where: { itemCode: item.code },
          select: { itemCode: true, imageUrl: true }
        });
        
        if (existingGrocery) {
          // Skip items that already have any non-null imageUrl (don't overwrite existing images)
          if (existingGrocery.imageUrl && existingGrocery.imageUrl.trim() !== '') {
            return { type: 'skipped' }; // Already has an image, don't overwrite
          }
          
          // Only update items with null or empty imageUrl
          await prisma.grocery.update({
            where: { itemCode: item.code },
            data: { imageUrl: item.image_url }
          });
          return { type: 'updated' };
        } else {
          return { type: 'notFound' };
        }
      } catch (error) {
        console.error(`❌ Error processing item ${item.code}:`, error);
        return { type: 'error' };
      }
    });
    
    // Wait for all promises in this chunk to complete
    const results = await Promise.all(promises);
    
    // Count results
    results.forEach(result => {
      switch (result.type) {
        case 'updated':
          updated++;
          break;
        case 'notFound':
          notFound++;
          break;
        case 'error':
          errors++;
          break;
        case 'skipped':
          // Don't count skipped items as they're already correct
          break;
      }
    });
  }
  
  return { updated, notFound, errors };
}

async function run() {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    const args = process.argv.slice(2);
    // Default to off_images.tsv in the same directory as this script
    const tsvFilePath = args[0] || path.join(dirname, 'off_images.tsv');
    
    if (!fs.existsSync(tsvFilePath)) {
      console.error(`❌ TSV file not found: ${tsvFilePath}`);
      console.log('Usage: npm run update-images [path/to/off_images.tsv]');
      console.log('If no path is provided, it will look for off_images.tsv in parser/utils/');
      process.exit(1);
    }
    
    console.log(`📂 Using TSV file: ${tsvFilePath}`);
    await updateGroceryImages(tsvFilePath);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run(); 