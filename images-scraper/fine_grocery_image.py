import asyncio
import json
import time
import os
import logging
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
        logging.StreamHandler(), 
        logging.FileHandler("scraper.log", mode='w', encoding='utf-8')
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
            logger.info("Successfully connected to the database.")
        except mysql.connector.Error as err:
            logger.error(f"Error connecting to database: {err}")
            raise

    async def disconnect(self):
        """Close database connection."""
        if self.connection and self.connection.is_connected():
            if self.cursor:
                self.cursor.close()
            self.connection.close()
            logger.info("Successfully disconnected from the database.")

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
            logger.info("Playwright setup complete.")
        except Exception as e:
            logger.error(f"Error setting up Playwright: {e}")
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
            logger.info("Playwright closed.")
        except Exception as e:
            logger.error(f"Error closing Playwright: {e}")

    async def search_product(self, product_name: str) -> bool:
        """Search for a product on Shufersal website."""
        if not self.page:
            logger.error("Page not initialized. Call setup_playwright() first.")
            return False

        logger.info(f"Navigating to base URL: {BASE_URL}")
        try:
            # Navigate to homepage
            await self.page.goto(BASE_URL, timeout=60000, wait_until="domcontentloaded")
            logger.info(f"Successfully navigated to {BASE_URL}")

            # Wait for and fill search input
            logger.info(f"Attempting to find search input: {SEARCH_INPUT_SELECTOR}")
            search_input = self.page.locator(SEARCH_INPUT_SELECTOR)
            await search_input.wait_for(state="visible", timeout=30000)
            
            logger.info(f"Typing '{product_name}' into search input.")
            await search_input.fill(product_name)
            
            # Submit search by pressing Enter (more reliable than clicking button)
            logger.info("Pressing Enter to submit search.")
            await search_input.press("Enter")

            # Wait for search results to load
            logger.info("Waiting for search results grid to load...")
            await self.page.wait_for_selector(PRODUCT_GRID_SELECTOR, timeout=30000, state="visible")
            await self.page.wait_for_load_state("networkidle", timeout=20000)
            logger.info("Search results grid loaded.")
            return True
            
        except PlaywrightTimeoutError:
            logger.warning(f"Timeout while searching for '{product_name}'. Product grid or elements not found in time.")
            # Save screenshot for debugging
            try:
                screenshot_name = f"error_search_{product_name.replace(' ','_').replace('/', '_')}.png"
                await self.page.screenshot(path=screenshot_name)
                logger.info(f"Screenshot saved to {screenshot_name}")
            except Exception as e_ss:
                logger.error(f"Could not save screenshot: {e_ss}")
            return False
        except Exception as e:
            logger.error(f"Error during search for '{product_name}': {e}")
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
            logger.info(f"Found {len(product_elements)} product items on the page.")

            if not product_elements:
                logger.info("No product items found on the current page.")
                return {}

            for item_element in product_elements:
                try:
                    # Extract product name from data-product-name attribute
                    product_name = await item_element.get_attribute("data-product-name")
                    if not product_name:
                        logger.warning("Product name from data-product-name attribute is missing. Skipping item.")
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
                                logger.debug(f"Extracted: Name='{product_name}', Image='{image_url_absolute}'")
                            else:
                                logger.debug(f"Duplicate product name '{product_name}' found on page, keeping first image.")
                        else:
                            logger.debug(f"Invalid or placeholder image URL for '{product_name}': {image_url_absolute}")
                    else:
                        logger.debug(f"No image URL found for product: '{product_name}'")

                except Exception as e:
                    logger.error(f"Error processing a product item: {e}")
                    continue
            
            logger.info(f"Extracted {len(extracted_data)} unique products with valid images from current page.")
            return extracted_data

        except Exception as e:
            logger.error(f"Error extracting products from results: {e}")
            return {}

    async def scrape_for_item_names(self, item_names_to_search: List[str]) -> Dict[str, str]:
        """
        Search for each item name and collect all products from search results.
        Returns dictionary of {product_name: image_url}.
        """
        if not self.page:
            await self.setup_playwright()

        all_found_products = {}
        
        for item_name in item_names_to_search:
            logger.info(f"--- Starting search for: {item_name} ---")
            
            if await self.search_product(item_name):
                # Small delay to ensure content is fully rendered
                await asyncio.sleep(2)
                
                page_products = await self.extract_products_from_results()
                for name, url in page_products.items():
                    if name not in all_found_products:
                        all_found_products[name] = url
                    else:
                        logger.debug(f"Product '{name}' already found from a previous search. Keeping existing image.")
            else:
                logger.warning(f"Search failed or no results for '{item_name}'.")
            
            # Small delay between searches to be respectful
            await asyncio.sleep(1)

        return all_found_products

    async def scrape_for_item_names_with_logging(self, item_names_to_search: List[str]) -> Dict[str, str]:
        """
        Search for each item name individually and log results after each search.
        Returns dictionary of {product_name: image_url}.
        """
        if not self.page:
            await self.setup_playwright()

        all_found_products = {}
        
        for index, item_name in enumerate(item_names_to_search, 1):
            print(f"\n🔍 [{index}/{len(item_names_to_search)}] SEARCHING FOR: '{item_name}'")
            print("-" * 60)
            
            logger.info(f"--- Starting search for: {item_name} ---")
            
            if await self.search_product(item_name):
                # Small delay to ensure content is fully rendered
                await asyncio.sleep(2)
                
                page_products = await self.extract_products_from_results()
                
                # Log individual search results
                if page_products:
                    print(f"✅ FOUND {len(page_products)} PRODUCTS:")
                    print("📋 JSON for this search:")
                    print(json.dumps(page_products, ensure_ascii=False, indent=2))
                    
                    # Add to overall collection
                    for name, url in page_products.items():
                        if name not in all_found_products:
                            all_found_products[name] = url
                        else:
                            logger.debug(f"Product '{name}' already found from a previous search. Keeping existing image.")
                            print(f"⚠️  Duplicate: '{name}' already found, keeping first image")
                else:
                    print(f"❌ NO PRODUCTS FOUND for '{item_name}'")
                    print("📋 JSON for this search: {}")
                    
            else:
                logger.warning(f"Search failed or no results for '{item_name}'.")
                print(f"💥 SEARCH FAILED for '{item_name}'")
                print("📋 JSON for this search: {}")
            
            print("-" * 60)
            # Small delay between searches to be respectful
            await asyncio.sleep(1)

        return all_found_products


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


async def update_database_with_scraped_data(scraped_data: Dict[str, str], db_manager: DatabaseManager) -> int:
    """Update database with scraped image URLs."""
    logger.info("Starting database update process...")
    updated_count = 0
    
    # Get all item names from DB for efficient matching
    db_item_names_set = await db_manager.get_all_item_names()

    for scraped_name, image_url in scraped_data.items():
        # Check if scraped name exists in database (exact match)
        if scraped_name in db_item_names_set:
            if await db_manager.update_product_image(scraped_name, image_url):
                updated_count += 1
        else:
            logger.debug(f"Scraped product '{scraped_name}' not found in database item names for update.")
    
    logger.info(f"Database update complete. {updated_count} products had their imageUrl updated.")
    return updated_count


async def main():
    """Main workflow orchestrator."""
    logger.info("🚀 Starting the Shufersal image scraping process.")

    db_manager = DatabaseManager()
    scraper = SupermarketScraper(headless=True)  # Set headless=False to see browser

    try:
        # 1. Database Integration: Connect and get product names
        logger.info("🔗 Connecting to database...")
        await db_manager.connect()
        
        product_names_to_search_for = await db_manager.get_products_without_images()
        
        if not product_names_to_search_for:
            logger.info("✅ No products in the database need image scraping. Exiting.")
            return

        logger.info(f"📦 Found {len(product_names_to_search_for)} products without images")
        print(f"\n🚀 PROCESSING MODE: Will search for {len(product_names_to_search_for)} products")
        print(f"🎯 Products to process: {', '.join(product_names_to_search_for[:5])}{'...' if len(product_names_to_search_for) > 5 else ''}")
        print("="*80)

        # 2. Automated Searching & 3. Data Extraction with individual logging
        logger.info("🚀 Setting up browser automation...")
        await scraper.setup_playwright()
        
        # Scrape products from search results one by one with logging
        logger.info("🔍 Starting search and extraction process...")
        scraped_products_data = await scraper.scrape_for_item_names_with_logging(product_names_to_search_for)

        if not scraped_products_data:
            logger.info("❌ No products were successfully scraped.")
            print("\n❌ FINAL RESULT: No products found in any search results")
            print("="*80)
        else:
            logger.info(f"✅ Total unique products scraped: {len(scraped_products_data)}")

            # Print final combined JSON
            print(f"\n📋 FINAL COMBINED JSON (ALL SEARCHES):")
            print("="*80)
            print(json.dumps(scraped_products_data, ensure_ascii=False, indent=2))
            print("="*80)
            print(f"📊 Total unique products found across all searches: {len(scraped_products_data)}")

            # 4. Data Processing: Save to JSON
            await save_to_json(scraped_products_data)

            # 5. Database Update
            print(f"\n🔄 UPDATING DATABASE...")
            updated_count = await update_database_with_scraped_data(scraped_products_data, db_manager)
            
            print(f"\n🎉 PROCESS COMPLETED!")
            print(f"   🔍 Database products searched: {len(product_names_to_search_for)}")
            print(f"   📊 Total unique products scraped: {len(scraped_products_data)}")
            print(f"   💾 Database updates: {updated_count}")
            print(f"   📁 JSON saved to: {JSON_OUTPUT_FILE}")
            print("="*80)

    except mysql.connector.Error as e:
        logger.critical(f"💥 Critical MySQL error occurred: {e}")
    except Exception as e:
        logger.critical(f"💥 Unexpected critical error occurred: {e}", exc_info=True)
    finally:
        # Cleanup
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
        results = await scraper.scrape_for_item_names(test_products)
        
        print(f"✅ Demo Results: Found {len(results)} products")
        for name, url in list(results.items())[:3]:
            print(f"   📦 {name} -> {url[:50]}...")
            
    finally:
        await scraper.close_playwright()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "demo":
        # Run demo: python fine_grocery_image.py demo
        asyncio.run(demo_single_search())
    else:
        # Run full process: python fine_grocery_image.py
        asyncio.run(main())
