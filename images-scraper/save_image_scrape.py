import asyncio
import json
import time
import logging
from typing import Dict, List, Tuple, Optional
import mysql.connector
from mysql.connector import Error

# Configure logging
LOG_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(
    level=logging.INFO, 
    format=LOG_FORMAT,
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Database Configuration (same as scraper)
DB_CONFIG = {
    'host': 'localhost',
    'user': 'dev',
    'password': 'dev123',
    'database': 'groczi',
    'port': 3306
}

# File paths
JSON_INPUT_FILE = "scraped_product_images.json"
BATCH_SIZE = 1000  # Process updates in batches for efficiency


class DatabaseUpdater:
    """Efficient database updater for image URLs."""
    
    def __init__(self, config: Dict = None):
        self.config = config or DB_CONFIG
        self.connection = None
        self.cursor = None

    async def connect(self):
        """Establish database connection with optimized settings."""
        try:
            self.connection = mysql.connector.connect(
                **self.config,
                autocommit=False,  # We'll handle commits manually for batching
                use_unicode=True,
                charset='utf8mb4'
            )
            self.cursor = self.connection.cursor(dictionary=True)
            logger.info("✅ Successfully connected to the database.")
        except mysql.connector.Error as err:
            logger.error(f"❌ Error connecting to database: {err}")
            raise

    async def disconnect(self):
        """Close database connection."""
        if self.connection and self.connection.is_connected():
            if self.cursor:
                self.cursor.close()
            self.connection.close()
            logger.info("✅ Successfully disconnected from the database.")

    async def get_existing_items_map(self) -> Dict[str, str]:
        """Get a map of itemName -> itemCode for all items in database for fast lookups."""
        if not self.cursor:
            logger.error("❌ Database not connected. Call connect() first.")
            return {}
        
        try:
            # Get all items with their itemCodes for efficient lookups
            query = "SELECT itemCode, itemName FROM grocery WHERE itemName IS NOT NULL AND itemName != ''"
            self.cursor.execute(query)
            
            items_map = {}
            for row in self.cursor.fetchall():
                items_map[row['itemName']] = row['itemCode']
            
            logger.info(f"📊 Loaded {len(items_map)} items from database for matching.")
            return items_map
            
        except mysql.connector.Error as err:
            logger.error(f"❌ Error fetching existing items: {err}")
            return {}

    async def batch_update_images(self, updates: List[Tuple[str, str]]) -> Tuple[int, int]:
        """
        Efficiently update image URLs in batches.
        updates: List of (imageUrl, itemCode) tuples
        Returns: (successful_updates, failed_updates)
        """
        if not self.cursor or not updates:
            return 0, 0
        
        successful = 0
        failed = 0
        
        try:
            # Use executemany for efficient batch updates
            query = "UPDATE grocery SET imageUrl = %s WHERE itemCode = %s"
            
            self.cursor.executemany(query, updates)
            successful = self.cursor.rowcount
            self.connection.commit()
            
            logger.info(f"✅ Batch update successful: {successful} rows updated")
            
        except mysql.connector.Error as err:
            logger.error(f"❌ Error in batch update: {err}")
            self.connection.rollback()
            failed = len(updates)
            
        return successful, failed

    async def update_single_item(self, item_name: str, image_url: str, item_code: str) -> bool:
        """Update a single item's image URL (fallback for failed batch items)."""
        if not self.cursor:
            return False
        
        try:
            query = "UPDATE grocery SET imageUrl = %s WHERE itemCode = %s"
            self.cursor.execute(query, (image_url, item_code))
            self.connection.commit()
            
            if self.cursor.rowcount > 0:
                return True
            else:
                logger.warning(f"⚠️  No rows updated for item code {item_code} ('{item_name}')")
                return False
                
        except mysql.connector.Error as err:
            logger.error(f"❌ Error updating single item '{item_name}': {err}")
            return False

    async def get_statistics(self) -> Dict[str, int]:
        """Get database statistics for reporting."""
        if not self.cursor:
            return {}
        
        try:
            stats = {}
            
            # Total items
            self.cursor.execute("SELECT COUNT(*) as total FROM grocery WHERE itemName IS NOT NULL AND itemName != ''")
            stats['total_items'] = self.cursor.fetchone()['total']
            
            # Items with images
            self.cursor.execute("SELECT COUNT(*) as with_images FROM grocery WHERE imageUrl IS NOT NULL AND imageUrl != ''")
            stats['items_with_images'] = self.cursor.fetchone()['with_images']
            
            # Items without images
            stats['items_without_images'] = stats['total_items'] - stats['items_with_images']
            
            return stats
            
        except mysql.connector.Error as err:
            logger.error(f"❌ Error getting statistics: {err}")
            return {}


async def load_scraped_data(filename: str = JSON_INPUT_FILE) -> Dict[str, str]:
    """Load scraped product data from JSON file."""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        logger.info(f"📁 Loaded {len(data)} products from {filename}")
        
        # Log some examples
        if data:
            logger.info("📦 Sample products loaded:")
            for i, (name, url) in enumerate(list(data.items())[:3]):
                logger.info(f"   {i+1}. {name[:40]}... -> {url[:50]}...")
        
        return data
        
    except FileNotFoundError:
        logger.error(f"❌ File not found: {filename}")
        return {}
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON in {filename}: {e}")
        return {}
    except Exception as e:
        logger.error(f"❌ Error loading {filename}: {e}")
        return {}


async def process_image_updates():
    """Main function to process and update image URLs efficiently."""
    
    start_time = time.time()
    logger.info("🚀 Starting efficient database update process...")
    
    # 1. Load scraped data
    logger.info("📁 Loading scraped product data...")
    scraped_data = await load_scraped_data()
    
    if not scraped_data:
        logger.error("❌ No data to process. Exiting.")
        return
    
    # 2. Connect to database
    db_updater = DatabaseUpdater()
    
    try:
        await db_updater.connect()
        
        # 3. Get initial statistics
        logger.info("📊 Getting initial database statistics...")
        initial_stats = await db_updater.get_statistics()
        
        if initial_stats:
            logger.info(f"📊 Initial Stats:")
            logger.info(f"   Total items: {initial_stats.get('total_items', 0)}")
            logger.info(f"   Items with images: {initial_stats.get('items_with_images', 0)}")
            logger.info(f"   Items without images: {initial_stats.get('items_without_images', 0)}")
        
        # 4. Get existing items map for fast lookups
        logger.info("🔍 Building fast lookup map...")
        existing_items_map = await db_updater.get_existing_items_map()
        
        if not existing_items_map:
            logger.error("❌ No items found in database. Exiting.")
            return
        
        # 5. Match scraped data with database items
        logger.info("🔗 Matching scraped products with database items...")
        
        matches_found = 0
        exact_matches = []
        no_matches = []
        
        for product_name, image_url in scraped_data.items():
            if product_name in existing_items_map:
                item_code = existing_items_map[product_name]
                exact_matches.append((image_url, item_code))
                matches_found += 1
            else:
                no_matches.append(product_name)
        
        logger.info(f"✅ Matching complete:")
        logger.info(f"   Exact matches: {matches_found}")
        logger.info(f"   No matches: {len(no_matches)}")
        
        if matches_found == 0:
            logger.warning("⚠️  No matches found. Nothing to update.")
            return
        
        # 6. Process updates in efficient batches
        logger.info(f"🔄 Processing {matches_found} updates in batches of {BATCH_SIZE}...")
        
        total_updated = 0
        total_failed = 0
        batch_count = 0
        
        # Process in batches
        for i in range(0, len(exact_matches), BATCH_SIZE):
            batch = exact_matches[i:i + BATCH_SIZE]
            batch_count += 1
            
            logger.info(f"🔄 Processing batch {batch_count} ({len(batch)} items)...")
            
            successful, failed = await db_updater.batch_update_images(batch)
            total_updated += successful
            total_failed += failed
            
            # Small delay between batches to avoid overwhelming the database
            if i + BATCH_SIZE < len(exact_matches):
                await asyncio.sleep(0.1)
        
        # 7. Get final statistics
        logger.info("📊 Getting final database statistics...")
        final_stats = await db_updater.get_statistics()
        
        # 8. Report results
        end_time = time.time()
        duration = end_time - start_time
        
        print("\n" + "="*80)
        print("🎉 DATABASE UPDATE COMPLETED!")
        print("="*80)
        print(f"📊 PROCESSING SUMMARY:")
        print(f"   Scraped products loaded: {len(scraped_data)}")
        print(f"   Database items checked: {len(existing_items_map)}")
        print(f"   Exact matches found: {matches_found}")
        print(f"   Products with no database match: {len(no_matches)}")
        print()
        print(f"🔄 UPDATE RESULTS:")
        print(f"   Successfully updated: {total_updated}")
        print(f"   Failed updates: {total_failed}")
        print(f"   Update success rate: {(total_updated/matches_found)*100:.1f}%")
        print()
        print(f"📊 DATABASE STATS CHANGE:")
        if initial_stats and final_stats:
            images_before = initial_stats.get('items_with_images', 0)
            images_after = final_stats.get('items_with_images', 0)
            improvement = images_after - images_before
            print(f"   Items with images before: {images_before}")
            print(f"   Items with images after: {images_after}")
            print(f"   Net improvement: +{improvement} items")
            print(f"   Total coverage: {(images_after/final_stats.get('total_items', 1))*100:.1f}%")
        print()
        print(f"⏱️  PERFORMANCE:")
        print(f"   Total duration: {duration:.2f} seconds")
        print(f"   Updates per second: {total_updated/duration:.1f}")
        print(f"   Batches processed: {batch_count}")
        print("="*80)
        
        # Log some no-match examples for debugging
        if no_matches:
            logger.info(f"📝 Sample products with no database matches:")
            for i, name in enumerate(no_matches[:5]):
                logger.info(f"   {i+1}. {name}")
            if len(no_matches) > 5:
                logger.info(f"   ... and {len(no_matches) - 5} more")
    
    except Exception as e:
        logger.error(f"💥 Critical error during processing: {e}", exc_info=True)
    
    finally:
        # Cleanup
        await db_updater.disconnect()


async def main():
    """Main entry point."""
    try:
        await process_image_updates()
    except KeyboardInterrupt:
        logger.info("🛑 Process interrupted by user.")
    except Exception as e:
        logger.critical(f"💥 Unexpected error: {e}", exc_info=True)


if __name__ == "__main__":
    asyncio.run(main())
