// Helper function to split array into batches
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export interface BatchProcessorConfig<T> {
  batchSize?: number; // defaults to 100
  saveItem: (item: T) => Promise<void | boolean>; // some save functions return boolean indicating success
}

export async function processBatchedItems<T>(
  items: T[],
  config: BatchProcessorConfig<T>
): Promise<void> {
  const { batchSize = 100, saveItem } = config;

  if (!items.length) return;

  // Batch parallel processing instead of sequential
  const batches = chunkArray(items, batchSize);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    // Process all items in this batch in parallel
    const savePromises = batch.map(async (item) => {
      try {
        await saveItem(item);
      } catch (err) {
       console.log("Error saving item", err)
      }
    });

    // Wait for all items in this batch to complete
    await Promise.all(savePromises);
  }
} 