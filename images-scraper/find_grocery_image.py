import asyncio
import json
import time
import os
import logging
import signal
import sys
from typing import List, Dict, Optional, Set
from urllib.parse import urljoin, urlparse
from playwright.async_api import async_playwright, Page, Browser, BrowserContext, TimeoutError as PlaywrightTimeoutError
import mysql.connector
from mysql.connector import Error

# Configure logging
LOG_FORMAT = '%(asctime)s - %(levelname)s - %(module)s - %(message)s'
logging.basicConfig(
    level=logging.INFO, 
    format=LOG_FORMAT,
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration Constants
DB_CONFIG = {
    'host': 'localhost',
    'user': 'dev',
    'password': 'dev123',
    'database': 'groczi',
    'port': 3306
}

# Shufersal-specific configuration based on HTML analysis
BASE_URL = "https://www.shufersal.co.il/online/he/S"
SEARCH_INPUT_SELECTOR = "input#js-site-search-input"
SEARCH_BUTTON_SELECTOR = "button.js_search_button"
PRODUCT_GRID_SELECTOR = "ul#mainProductGrid"
PRODUCT_ITEM_SELECTOR = "ul#mainProductGrid > li.tileBlock"
PRODUCT_IMAGE_SELECTOR = "a.imgContainer img.pic"

# Image validation constants
VALID_IMAGE_HOST = "res.cloudinary.com"
VALID_IMAGE_PATH_CONTAINS = "/prod/product_images/"
PLACEHOLDER_IMAGE_URL = "https://media.shufersal.co.il/product_images/default/M_P_default.png"
PLACEHOLDER_PATTERNS = ["/fix.png", "placeholder", "default", "no-image"]

# Output configuration
JSON_OUTPUT_FILE = "scraped_product_images.json"
PROGRESS_JSON_FILE = "progress_scraped_products.json"

# Global variable for graceful shutdown
scraped_data_global = {}


async def load_existing_json(filename: str = JSON_OUTPUT_FILE) -> Dict[str, str]:
    """Load existing JSON file to avoid re-scraping."""
    try:
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logger.info(f"✅ Loaded {len(data)} existing products from {filename}")
            return data
        else:
            logger.info(f"ℹ️  No existing file found at {filename}. Starting fresh.")
            return {}
    except Exception as e:
        logger.error(f"❌ Error loading existing JSON: {e}")
        return {}


def setup_signal_handlers():
    """Setup signal handlers for graceful shutdown."""
    def signal_handler(sig, frame):
        logger.info("🛑 Interrupt received! Saving progress...")
        if scraped_data_global:
            try:
                # Force synchronous save to avoid async issues during shutdown
                with open("emergency_save.json", 'w', encoding='utf-8') as f:
                    json.dump(scraped_data_global, f, ensure_ascii=False, indent=4)
                logger.info(f"💾 Emergency save completed: {len(scraped_data_global)} products")
            except Exception as e:
                logger.error(f"❌ Error during emergency save: {e}")
        
        logger.info("🚨 Force exiting - skipping browser cleanup to avoid hang...")
        os._exit(0)  # Force exit without cleanup to avoid hanging
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)


class DatabaseManager:
    """Handles all MySQL database operations."""
    
    def __init__(self, config: Dict = None):
        self.config = config or DB_CONFIG
        self.connection = None
        self.cursor = None

    async def connect(self):
        """Establish database connection."""
        try:
            self.connection = mysql.connector.connect(**self.config)
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

    async def get_all_product_names(self, limit: int = None) -> List[str]:
        """Get ALL product names from database for comprehensive scraping."""
        if not self.cursor:
            logger.error("❌ Database not connected. Call connect() first.")
            return []
        
        try:
            query = "SELECT DISTINCT itemName FROM grocery WHERE itemName IS NOT NULL AND itemName != '' ORDER BY itemName"
            if limit:
                query += f" LIMIT {limit}"
            
            self.cursor.execute(query)
            products = [row['itemName'] for row in self.cursor.fetchall() if row['itemName']]
            logger.info(f"📦 Found {len(products)} total products in database.")
            return products
        except mysql.connector.Error as err:
            logger.error(f"❌ Error fetching all products: {err}")
            return []

    async def get_products_without_images(self, limit: int = None) -> List[str]:
        """Get list of product names that don't have images."""
        if not self.cursor:
            logger.error("Database not connected. Call connect() first.")
            return []
        
        try:
            query = "SELECT itemName FROM grocery WHERE (imageUrl IS NULL OR imageUrl = '') AND itemName IS NOT NULL AND itemName != ''"
            if limit:
                query += f" LIMIT {limit}"
            
            self.cursor.execute(query)
            products = [row['itemName'] for row in self.cursor.fetchall() if row['itemName']]
            logger.info(f"Found {len(products)} products without images.")
            return products
        except mysql.connector.Error as err:
            logger.error(f"Error fetching products without images: {err}")
            return []

    async def get_all_item_names(self) -> Set[str]:
        """Get all item names from database for matching purposes."""
        if not self.cursor:
            logger.error("Database not connected. Call connect() first.")
            return set()
        
        try:
            query = "SELECT itemName FROM grocery WHERE itemName IS NOT NULL AND itemName != ''"
            self.cursor.execute(query)
            item_names = {row['itemName'] for row in self.cursor.fetchall()}
            logger.info(f"Fetched {len(item_names)} distinct item names from the database.")
            return item_names
        except mysql.connector.Error as err:
            logger.error(f"Error fetching all item names: {err}")
            return set()

    async def update_product_image(self, item_name: str, image_url: str) -> bool:
        """Update image URL for a specific product."""
        if not self.cursor:
            logger.error("Database not connected. Call connect() first.")
            return False
        
        try:
            query = "UPDATE grocery SET imageUrl = %s WHERE itemName = %s"
            self.cursor.execute(query, (image_url, item_name))
            self.connection.commit()
            
            if self.cursor.rowcount > 0:
                logger.info(f"Updated image URL for '{item_name}' to '{image_url}'.")
                return True
            else:
                logger.debug(f"No rows updated for '{item_name}'. It might not exist or URL is same.")
                return False
        except mysql.connector.Error as err:
            logger.error(f"Error updating product image for '{item_name}': {err}")
            return False


def is_search_term_covered(search_term: str, existing_products: Dict[str, str]) -> bool:
    """Check if a search term is likely already covered by existing results."""
    search_lower = search_term.lower().strip()
    
    # Check if any existing product name contains the search term or vice versa
    for product_name in existing_products.keys():
        product_lower = product_name.lower().strip()
        
        # If search term is contained in existing product name or vice versa
        if (search_lower in product_lower or product_lower in search_lower) and len(search_lower) > 2:
            return True
    
    return False


class SupermarketScraper:
    """Handles Playwright automation for Shufersal website scraping."""
    
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None

    def _is_valid_image_url(self, url: str) -> bool:
        """Validate if image URL is a real product image (not placeholder)."""
        if not url:
            return False
        
        # Check for known placeholder URLs
        if url == PLACEHOLDER_IMAGE_URL:
            logger.debug(f"Filtered out placeholder image: {url}")
            return False
        
        # Check for placeholder patterns
        url_lower = url.lower()
        for pattern in PLACEHOLDER_PATTERNS:
            if pattern in url_lower:
                logger.debug(f"Filtered out placeholder image by pattern '{pattern}': {url}")
                return False
        
        # Validate Cloudinary host (Shufersal uses Cloudinary)
        if VALID_IMAGE_HOST not in url:
            logger.debug(f"Filtered out image from non-approved host: {url}")
            return False
        
        # Check for product image path
        if VALID_IMAGE_PATH_CONTAINS not in url:
            logger.debug(f"Filtered out image not in product path: {url}")
            return False
        
        return True

    async def setup_playwright(self):
        """Initialize Playwright browser and page."""
        try:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=self.headless)
            self.context = await self.browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                viewport={'width': 1920, 'height': 1080}
            )
            self.page = await self.context.new_page()
            logger.info("✅ Playwright setup complete.")
        except Exception as e:
            logger.error(f"❌ Error setting up Playwright: {e}")
            raise

    async def close_playwright(self):
        """Close Playwright browser and cleanup."""
        try:
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
            logger.info("✅ Playwright closed.")
        except Exception as e:
            logger.error(f"❌ Error closing Playwright: {e}")

    async def search_product(self, product_name: str) -> bool:
        """Search for a product on Shufersal website."""
        if not self.page:
            logger.error("Page not initialized. Call setup_playwright() first.")
            return False

        try:
            # Navigate to homepage
            await self.page.goto(BASE_URL, timeout=60000, wait_until="domcontentloaded")

            # Wait for and fill search input
            search_input = self.page.locator(SEARCH_INPUT_SELECTOR)
            await search_input.wait_for(state="visible", timeout=30000)
            await search_input.fill(product_name)
            await search_input.press("Enter")

            # Wait for search results to load
            await self.page.wait_for_selector(PRODUCT_GRID_SELECTOR, timeout=30000, state="visible")
            await self.page.wait_for_load_state("networkidle", timeout=15000)
            return True
            
        except PlaywrightTimeoutError:
            logger.warning(f"⏰ Timeout while searching for '{product_name}'.")
            return False
        except Exception as e:
            logger.error(f"❌ Error during search for '{product_name}': {e}")
            return False

    async def extract_products_from_results(self) -> Dict[str, str]:
        """Extract all products from current search results page."""
        if not self.page:
            logger.error("Page not initialized.")
            return {}

        extracted_data = {}
        try:
            # Get all product items
            product_elements = await self.page.locator(PRODUCT_ITEM_SELECTOR).all()

            if not product_elements:
                return {}

            for item_element in product_elements:
                try:
                    # Extract product name from data-product-name attribute
                    product_name = await item_element.get_attribute("data-product-name")
                    if not product_name:
                        continue
                    
                    product_name = product_name.strip()

                    # Extract image URL
                    image_element = item_element.locator(PRODUCT_IMAGE_SELECTOR)
                    image_url_relative = await image_element.get_attribute("src")

                    if image_url_relative:
                        # Convert to absolute URL
                        image_url_absolute = urljoin(self.page.url, image_url_relative)
                        
                        if self._is_valid_image_url(image_url_absolute):
                            if product_name not in extracted_data:
                                extracted_data[product_name] = image_url_absolute
                            else:
                                logger.debug(f"Duplicate product name '{product_name}' found on page, keeping first image.")
                        else:
                            logger.debug(f"Invalid or placeholder image URL for '{product_name}': {image_url_absolute}")

                except Exception as e:
                    logger.error(f"Error processing a product item: {e}")
                    continue
            
            return extracted_data

        except Exception as e:
            logger.error(f"Error extracting products from results: {e}")
            return {}

    async def scrape_for_item_names_fast(self, item_names_to_search: List[str], 
                                       existing_data: Dict[str, str] = None,
                                       save_interval: int = 100) -> Dict[str, str]:
        """
        Fast scraping for thousands of items with progress saving and smart duplicate avoidance.
        """
        global scraped_data_global
        
        if not self.page:
            await self.setup_playwright()

        all_found_products = existing_data or {}
        scraped_data_global = all_found_products  # For signal handler
        total_items = len(item_names_to_search)
        processed_count = 0
        new_products_count = 0
        
        logger.info(f"🚀 Starting fast scraping for {total_items} items...")
        
        for index, item_name in enumerate(item_names_to_search, 1):
            # Smart duplicate avoidance - skip if likely already covered
            if is_search_term_covered(item_name, all_found_products):
                logger.debug(f"⏭️  Skipping '{item_name}' - likely already covered")
                continue
                
            logger.info(f"🔍 [{processed_count + 1}/{total_items}] Searching: '{item_name}'")
            
            if await self.search_product(item_name):
                # Short delay for page to fully load
                await asyncio.sleep(0.3)
                
                page_products = await self.extract_products_from_results()
                
                # Add new products (avoid duplicates)
                new_count = 0
                for name, url in page_products.items():
                    if name not in all_found_products:
                        all_found_products[name] = url
                        new_count += 1
                        new_products_count += 1
                
                if new_count > 0:
                    logger.info(f"✅ Found {new_count} new products | Total: {len(all_found_products)}")
                else:
                    logger.debug(f"ℹ️  No new products for '{item_name}'")
            else:
                logger.warning(f"❌ Search failed for '{item_name}'")
            
            processed_count += 1
            
            # Save progress periodically
            if processed_count % save_interval == 0:
                await save_to_json(all_found_products, PROGRESS_JSON_FILE)
                logger.info(f"💾 Progress saved: {len(all_found_products)} total products after {processed_count} searches")
            
            # Small delay to be respectful to the website
            await asyncio.sleep(0.2)

        logger.info(f"🎉 Fast scraping completed! Processed {processed_count} searches, found {new_products_count} new products")
        return all_found_products

    async def scrape_batch(self, items_batch: List[str], browser_id: int, existing_data: Dict[str, str] = None, 
                         progress_callback=None, save_interval: int = 50) -> Dict[str, str]:
        """
        Scrape a batch of items for parallel processing with periodic saving.
        """
        if not self.page:
            await self.setup_playwright()

        batch_results = {}
        batch_size = len(items_batch)
        processed_count = 0
        
        logger.info(f"🤖 Browser {browser_id}: Starting batch of {batch_size} items")
        
        for index, item_name in enumerate(items_batch, 1):
            # Smart duplicate avoidance
            if existing_data and is_search_term_covered(item_name, existing_data):
                logger.debug(f"🤖 Browser {browser_id}: Skipping '{item_name}' - likely already covered")
                continue
                
            logger.info(f"🤖 Browser {browser_id}: [{index}/{batch_size}] Searching: '{item_name}'")
            
            if await self.search_product(item_name):
                # Reduced delay for parallel processing
                await asyncio.sleep(0.2)
                
                page_products = await self.extract_products_from_results()
                
                # Add new products
                new_count = 0
                for name, url in page_products.items():
                    if name not in batch_results:
                        batch_results[name] = url
                        new_count += 1
                
                if new_count > 0:
                    logger.info(f"🤖 Browser {browser_id}: ✅ Found {new_count} new products")
                else:
                    logger.debug(f"🤖 Browser {browser_id}: ℹ️  No new products for '{item_name}'")
            else:
                logger.warning(f"🤖 Browser {browser_id}: ❌ Search failed for '{item_name}'")
            
            processed_count += 1
            
            # Periodic saving for this browser
            if processed_count % save_interval == 0:
                browser_filename = f"browser_{browser_id}_progress.json"
                await save_to_json(batch_results, browser_filename)
                logger.info(f"🤖 Browser {browser_id}: 💾 Progress saved ({len(batch_results)} products)")
                
                # Notify main thread for combined progress saving
                if progress_callback:
                    await progress_callback(browser_id, batch_results)
            
            # Respectful delay between searches
            await asyncio.sleep(0.5)  # Slightly longer delay for parallel processing

        logger.info(f"🤖 Browser {browser_id}: ✅ Batch completed! Found {len(batch_results)} products")
        
        # Final save for this browser
        browser_filename = f"browser_{browser_id}_final.json"
        await save_to_json(batch_results, browser_filename)
        
        return batch_results


async def scrape_parallel(item_names_to_search: List[str], 
                         existing_data: Dict[str, str] = None, 
                         num_browsers: int = 10,
                         save_interval: int = 100) -> Dict[str, str]:
    """
    Parallel scraping with multiple browser instances and periodic progress saving.
    """
    global scraped_data_global
    
    all_found_products = existing_data or {}
    scraped_data_global = all_found_products
    total_items = len(item_names_to_search)
    
    # Progress tracking for combined saves
    browser_progress = {}
    last_combined_save = 0
    
    async def progress_callback(browser_id: int, browser_results: Dict[str, str]):
        """Called when a browser saves progress - combines and saves all progress."""
        nonlocal last_combined_save
        
        browser_progress[browser_id] = browser_results
        
        # Combine all browser results
        combined_progress = dict(all_found_products)
        total_from_browsers = 0
        
        for browser_data in browser_progress.values():
            for name, url in browser_data.items():
                if name not in combined_progress:
                    combined_progress[name] = url
                    total_from_browsers += 1
        
        # Save combined progress every 500 total new products (50 per browser * 10)
        if total_from_browsers - last_combined_save >= 500:
            await save_to_json(combined_progress, PROGRESS_JSON_FILE)
            scraped_data_global.update(combined_progress)  # Update global for signal handler
            logger.info(f"💾 COMBINED progress saved: {len(combined_progress)} total products")
            last_combined_save = total_from_browsers
    
    # Split items into batches for each browser
    batch_size = len(item_names_to_search) // num_browsers
    batches = []
    
    for i in range(num_browsers):
        start_idx = i * batch_size
        if i == num_browsers - 1:  # Last batch gets any remaining items
            end_idx = len(item_names_to_search)
        else:
            end_idx = (i + 1) * batch_size
        
        batch = item_names_to_search[start_idx:end_idx]
        if batch:  # Only add non-empty batches
            batches.append(batch)
    
    logger.info(f"🚀 Starting PARALLEL scraping with {len(batches)} browsers")
    logger.info(f"📊 Total items: {total_items}, Average per browser: {batch_size}")
    logger.info(f"💾 Progress saving: Every 50 items per browser + combined every 500 total")
    
    # Create browser instances
    scrapers = []
    for i in range(len(batches)):
        scraper = SupermarketScraper(headless=True)
        scrapers.append(scraper)
    
    try:
        # Setup all browsers in parallel
        logger.info("⚡ Setting up browsers in parallel...")
        setup_tasks = [scraper.setup_playwright() for scraper in scrapers]
        await asyncio.gather(*setup_tasks)
        
        # Start parallel scraping with progress callback
        logger.info("🔥 Starting parallel batch processing...")
        scraping_tasks = []
        for i, (scraper, batch) in enumerate(zip(scrapers, batches)):
            task = scraper.scrape_batch(
                batch, 
                browser_id=i+1, 
                existing_data=existing_data,
                progress_callback=progress_callback,
                save_interval=50
            )
            scraping_tasks.append(task)
        
        # Wait for all browsers to complete
        batch_results = await asyncio.gather(*scraping_tasks, return_exceptions=True)
        
        # Combine final results from all browsers
        combined_results = dict(all_found_products)
        total_new_products = 0
        
        for i, result in enumerate(batch_results):
            if isinstance(result, Exception):
                logger.error(f"🤖 Browser {i+1} failed with error: {result}")
                continue
            
            browser_new_count = 0
            for name, url in result.items():
                if name not in combined_results:
                    combined_results[name] = url
                    browser_new_count += 1
                    total_new_products += 1
            
            logger.info(f"🤖 Browser {i+1}: Added {browser_new_count} unique products")
        
        # Update global for signal handler
        scraped_data_global = combined_results
        
        logger.info(f"🎉 PARALLEL SCRAPING COMPLETED!")
        logger.info(f"   📊 Total unique products: {len(combined_results)}")
        logger.info(f"   ✨ New products found: {total_new_products}")
        logger.info(f"   ⚡ Speed boost: ~{num_browsers}x faster than single browser")
        
        return combined_results
        
    except Exception as e:
        logger.error(f"💥 Error in parallel scraping: {e}")
        return all_found_products
    finally:
        # Clean up all browsers
        logger.info("🧹 Cleaning up browsers...")
        cleanup_tasks = [scraper.close_playwright() for scraper in scrapers]
        await asyncio.gather(*cleanup_tasks, return_exceptions=True)


async def save_to_json(data: Dict[str, str], filename: str = JSON_OUTPUT_FILE):
    """Save scraped data to JSON file."""
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        logger.info(f"Scraped data saved to {filename}")
        
        # Log some examples
        if data:
            logger.info("Sample products saved:")
            for i, (name, url) in enumerate(list(data.items())[:3]):
                logger.info(f"  {i+1}. {name} -> {url[:50]}...")
    except IOError as e:
        logger.error(f"Error writing JSON to file: {e}")


async def main_json_only():
    """Optimized main function focused on building comprehensive JSON file."""
    global scraped_data_global
    
    # Setup signal handlers for graceful shutdown
    setup_signal_handlers()
    
    logger.info("🚀 Starting FAST JSON-ONLY scraping process for items WITHOUT existing imageUrls.")

    db_manager = DatabaseManager()

    try:
        # 1. Load existing JSON to avoid re-scraping
        logger.info("📁 Loading existing JSON data...")
        existing_data = await load_existing_json()
        
        # 2. Connect to database and get products WITHOUT images
        logger.info("🔗 Connecting to database...")
        await db_manager.connect()
        
        products_without_images = await db_manager.get_products_without_images()
        
        if not products_without_images:
            logger.info("✅ No products in database need image scraping. Exiting.")
            return

        logger.info(f"📦 Products without images in database: {len(products_without_images)}")
        logger.info(f"📊 Already scraped: {len(existing_data)}")
        
        # 3. Filter out items we might have already searched for
        remaining_items = []
        skipped_count = 0
        for item in products_without_images:
            if not is_search_term_covered(item, existing_data):
                remaining_items.append(item)
            else:
                skipped_count += 1
        
        logger.info(f"⏭️  Skipping {skipped_count} items likely already covered")
        logger.info(f"🎯 Remaining to process: {len(remaining_items)} items")
        
        if not remaining_items:
            logger.info("✅ All items appear to be covered already. Final save...")
            await save_to_json(existing_data)
            return

        print(f"\n🚀 FAST PARALLEL PROCESSING MODE (10 Browsers):")
        print(f"   📁 Existing products: {len(existing_data)}")
        print(f"   🎯 Items to process: {len(remaining_items)}")
        print(f"   🤖 Browsers: 10 parallel instances")
        print(f"   💾 Progress saves: Every 50 items per browser + combined every 500")
        print(f"   ⚡ Expected duration: ~{len(remaining_items) * 0.05 / 60:.1f} minutes (~10x faster)")
        print("="*80)

        # 4. Disconnect from database (we don't need it anymore)
        await db_manager.disconnect()

        # 5. Start fast PARALLEL scraping (browsers will be created automatically)
        logger.info("🔍 Starting FAST PARALLEL search and extraction process...")
        final_scraped_data = await scrape_parallel(
            remaining_items, 
            existing_data=existing_data,
            num_browsers=10,
            save_interval=100
        )

        # 6. Final save
        logger.info("💾 Saving final comprehensive JSON...")
        await save_to_json(final_scraped_data)
        
        # 7. Results summary
        new_products = len(final_scraped_data) - len(existing_data)
        
        print(f"\n🎉 IMAGE SCRAPING FOR MISSING ITEMS COMPLETED!")
        print(f"   📦 Items without images processed: {len(products_without_images)}")
        print(f"   📊 Total unique products found: {len(final_scraped_data)}")
        print(f"   ✨ New products added: {new_products}")
        print(f"   📁 JSON saved to: {JSON_OUTPUT_FILE}")
        print(f"   📈 Success rate: {len(final_scraped_data) / len(products_without_images) * 100:.1f}% coverage")
        print("="*80)

    except mysql.connector.Error as e:
        logger.critical(f"💥 Critical MySQL error occurred: {e}")
    except Exception as e:
        logger.critical(f"💥 Unexpected critical error occurred: {e}", exc_info=True)
    finally:
        # Cleanup
        if db_manager:
            await db_manager.disconnect()
        logger.info("🏁 Fast JSON-only scraping process finished.")


async def main():
    """Original main function for backwards compatibility."""
    logger.info("🚀 Starting the original Shufersal image scraping process.")
    logger.info("💡 TIP: Use 'python fine_grocery_image.py fast' for optimized JSON-only processing")

    db_manager = DatabaseManager()
    scraper = SupermarketScraper(headless=True)

    try:
        # 1. Database Integration: Connect and get product names
        logger.info("🔗 Connecting to database...")
        await db_manager.connect()
        
        product_names_to_search_for = await db_manager.get_products_without_images()
        
        if not product_names_to_search_for:
            logger.info("✅ No products in the database need image scraping. Exiting.")
            return

        logger.info(f"📦 Found {len(product_names_to_search_for)} products without images")

        # 2. Setup browser and scrape
        logger.info("🚀 Setting up browser automation...")
        await scraper.setup_playwright()
        
        scraped_products_data = await scraper.scrape_for_item_names_fast(product_names_to_search_for)

        if scraped_products_data:
            logger.info(f"✅ Total unique products scraped: {len(scraped_products_data)}")
            await save_to_json(scraped_products_data)
            print(f"📁 JSON saved to: {JSON_OUTPUT_FILE}")

    except Exception as e:
        logger.critical(f"💥 Unexpected critical error occurred: {e}", exc_info=True)
    finally:
        if scraper:
            await scraper.close_playwright()
        if db_manager:
            await db_manager.disconnect()
        logger.info("🏁 Scraping process finished.")


async def demo_single_search():
    """Demo function to test single product search."""
    print("🧪 Demo: Testing single product search...")
    
    scraper = SupermarketScraper(headless=False)  # Show browser for demo
    try:
        await scraper.setup_playwright()
        
        test_products = ["קוטג", "חלב"]
        results = await scraper.scrape_for_item_names_fast(test_products)
        
        print(f"✅ Demo Results: Found {len(results)} products")
        for name, url in list(results.items())[:3]:
            print(f"   📦 {name} -> {url[:50]}...")
        
        # Save demo results to JSON file
        if results:
            demo_filename = "demo_results.json"
            await save_to_json(results, demo_filename)
            print(f"💾 Demo results saved to: {demo_filename}")
        else:
            print("❌ No results to save")
            
    finally:
        await scraper.close_playwright()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "demo":
            # Run demo: python fine_grocery_image.py demo
            asyncio.run(demo_single_search())
        elif sys.argv[1] == "fast":
            # Run optimized JSON-only process: python fine_grocery_image.py fast
            asyncio.run(main_json_only())
        elif sys.argv[1] == "parallel":
            # Run parallel process (same as fast, but explicit): python fine_grocery_image.py parallel
            asyncio.run(main_json_only())
        else:
            print("Usage:")
            print("  python find_grocery_image.py          # Original process")
            print("  python find_grocery_image.py fast     # Fast parallel process (10 browsers)")
            print("  python find_grocery_image.py parallel # Fast parallel process (10 browsers)")
            print("  python find_grocery_image.py demo     # Demo with 2 test products")
    else:
        # Run original process: python fine_grocery_image.py
        asyncio.run(main())
