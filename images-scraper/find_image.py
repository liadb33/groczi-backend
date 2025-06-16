# find_image.py
import sys
import io
import time
import random
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import tempfile
from urllib.parse import quote_plus

# Imports for WebDriverWait
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def setup_chrome_driver():
    """Setup Chrome driver with fallback options"""
    options = Options()
    
    # Use a clean temporary profile to avoid conflicts
    # Note: This temp_dir is not automatically cleaned up by this script.
    # For long-running services, consider adding cleanup logic (e.g., using shutil.rmtree).
    temp_dir = tempfile.mkdtemp()
    options.add_argument(f"--user-data-dir={temp_dir}")
    
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-web-security")
    options.add_argument("--allow-running-insecure-content")
    options.add_argument("--disable-features=VizDisplayCompositor")
    # Consider adding options.add_argument("--headless=new") if running in a headless environment
    
    try:
        driver = webdriver.Chrome(options=options)
        return driver
    except Exception as e:
        print(f"Error setting up Chrome driver: {e}", file=sys.stderr)
        return None

def is_valid_barcode(code: str) -> bool:
    return code.isdigit() and len(code) == 13

def search_google_images(query: str) -> str | None:
    """Search Google Images and return the URL of the first relevant image from the top results."""
    driver = setup_chrome_driver()
    if not driver:
        return None
    
    try:
        encoded_query = quote_plus(query)
        search_url = f"https://www.google.com/search?q={encoded_query}&tbm=isch&safe=off"
        driver.get(search_url)
        
        print(f"Navigated to Google Images search for query: \"{query}\"", file=sys.stderr)
        
        # Wait for the image results area to load, specifically the first image cell container
        # div#islrg is the main container for image results. div[data-ri="0"] is the first result cell.
        wait_timeout = 20 # seconds
        try:
            WebDriverWait(driver, wait_timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'div#islrg div[data-ri="0"]'))
            )
            print("Image results page loaded, first image cell [data-ri='0'] is present.", file=sys.stderr)
        except TimeoutException:
            # Handle potential cookie consent pop-ups or other overlays if the main content isn't found
            consent_selectors = [
                "button[aria-label*='Accept all']", 
                "button[aria-label*='Reject all']",
                "button[id*='accept']",
                "button[class*='consent']",
                "div[role='dialog'] button:first-of-type", # A common pattern for accept
            ]
            consent_clicked = False
            for sel in consent_selectors:
                try:
                    consent_button = driver.find_element(By.CSS_SELECTOR, sel)
                    if consent_button.is_displayed() and consent_button.is_enabled():
                        print(f"Attempting to click consent button matching selector: {sel}", file=sys.stderr)
                        consent_button.click()
                        consent_clicked = True
                        # Wait for page to react after clicking consent
                        WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, 'div#islrg div[data-ri="0"]'))
                        )
                        print("Image results page loaded after handling consent dialog.", file=sys.stderr)
                        break 
                except Exception:
                    continue # Button not found with this selector or other interaction error

            if not consent_clicked: # If no consent button was found or successfully clicked
                print(f"Timeout ({wait_timeout}s) waiting for image results (div#islrg div[data-ri='0']) to load. Page title: {driver.title}", file=sys.stderr)
                # For debugging, you can save page source here:
                # with open("debug_page_source_timeout.html", "w", encoding="utf-8") as f:
                #    f.write(driver.page_source)
                # print("Saved page source to debug_page_source_timeout.html", file=sys.stderr)
                return None
        
        # Find all image result divs. These are containers for individual image thumbnails.
        # Google uses `data-ri` (result index) for these. They are ordered in the DOM
        # as they appear visually (top-to-bottom, left-to-right).
        # We scope this to `div#islrg` (Image Search Results Grid) to be more specific.
        image_result_divs = driver.find_elements(By.CSS_SELECTOR, "div#islrg div[data-ri]")
        
        if not image_result_divs:
            print("No image result divs (div[data-ri]) found within div#islrg. No images to process.", file=sys.stderr)
            return None

        print(f"Found {len(image_result_divs)} image result divs with data-ri attribute.", file=sys.stderr)

        # Iterate through the found image result divs.
        # The first one that contains an <img> with a valid 'src' attribute will be chosen.
        for i, result_div in enumerate(image_result_divs):
            # The goal is an image from the "first visible row".
            # By iterating in DOM order, we naturally process top results first.
            try:
                img_element = result_div.find_element(By.TAG_NAME, "img")
                img_src = img_element.get_attribute("src")
                
                # Log src for the first few images to help debug if needed
                if i < 5: # Log details for the first 5 candidate images
                    data_ri_val = result_div.get_attribute('data-ri')
                    src_preview = img_src[:100] + "..." if img_src and len(img_src) > 100 else img_src
                    print(f"Inspecting image #{i} (data-ri: {data_ri_val}): src='{src_preview}'", file=sys.stderr)

                if img_src and img_src.startswith("http"):
                    # Filter out known non-image/icon gstatic URLs.
                    # This helps avoid returning small icons or branding elements.
                    undesirable_gstatic_patterns = [
                        "gstatic.com/images/branding/searchlogo",
                        "gstatic.com/images/icons",
                        "gstatic.com/images/cleardot.gif"
                    ]
                    if any(pattern in img_src for pattern in undesirable_gstatic_patterns):
                        print(f"Skipping common gstatic non-image URL: {img_src}", file=sys.stderr)
                        continue # Move to the next image result

                    data_ri_val = result_div.get_attribute('data-ri')
                    print(f"Found valid image at index {i} (data-ri: {data_ri_val}): {img_src}", file=sys.stderr)
                    return img_src
                # else:
                #    If src is base64 (e.g., "data:image/...") or not an http/https URL, it's skipped.
                #    print(f"Image #{i} src ('{src_preview}') is not a direct http(s) URL or is empty. Skipping.", file=sys.stderr)

            except NoSuchElementException:
                # This div[data-ri] did not contain an <img> tag directly, or it's structured differently.
                data_ri_val = result_div.get_attribute('data-ri')
                print(f"No <img> tag found directly within result div #{i} (data-ri: {data_ri_val}). Skipping.", file=sys.stderr)
                continue
            except Exception as e:
                data_ri_val = result_div.get_attribute('data-ri')
                print(f"Error processing result div #{i} (data-ri: {data_ri_val}): {e}", file=sys.stderr)
                continue 
        
        print("No image with a suitable 'src' attribute (starting with 'http' and not a filtered gstatic URL) found in the processed results.", file=sys.stderr)
        return None
            
    except Exception as e:
        print(f"An unexpected error occurred in search_google_images: {e}", file=sys.stderr)
        # For debugging, you might want to save page source or screenshot here
        # if driver:
        #     try:
        #         filename = f"error_page_source_{query.replace(' ','_')}.html"
        #         with open(filename, "w", encoding="utf-8") as f:
        #             f.write(driver.page_source)
        #         print(f"Saved page source to {filename}", file=sys.stderr)
        #     except Exception as ex_save:
        #         print(f"Could not save page source: {ex_save}", file=sys.stderr)
        return None
    finally:
        if driver:
            driver.quit()

def search_google_photos(query: str) -> str | None:
    """Search Google Photos and return the first image URL"""
    driver = setup_chrome_driver()
    if not driver:
        return None
    
    try:
        # Open Google Photos
        driver.get("https://photos.google.com")
        
        # Wait for page load and login
        time.sleep(10)
        
        # Check if we need to login
        current_url = driver.current_url
        if "accounts.google.com" in current_url or "signin" in current_url or "myaccount.google.com" in current_url:
            print("Google Photos requires login. Falling back to Google Images search.", file=sys.stderr)
            driver.quit()
            return search_google_images(query) # This recursive call might be problematic if search_google_images also fails.
        
        # Find the search box and enter search query
        try:
            search_selectors = [
                'input[aria-label="Search in Photos"]',
                'input[placeholder*="Search"]',
                'input[data-ved]',
                '[data-testid="search-input"]'
            ]
            
            search_box = None
            for selector in search_selectors:
                try:
                    search_box = driver.find_element(By.CSS_SELECTOR, selector)
                    break
                except NoSuchElementException:
                    continue
            
            if not search_box:
                print("Could not find search box, falling back to Google Images", file=sys.stderr)
                driver.quit()
                return search_google_images(query)
                
            search_box.click()
            time.sleep(2)
            search_box.send_keys(query)
            search_box.send_keys(Keys.ENTER)
            
            time.sleep(10) # Wait for search results
            
            photo_selectors = [
                'div[role="list"] div[role="listitem"]',
                '[data-testid="photo"]',
                'div[data-ved] img',
                'img[src*="lh3.googleusercontent.com"]'
            ]
            
            photos = []
            for selector in photo_selectors:
                try:
                    photos = driver.find_elements(By.CSS_SELECTOR, selector)
                    if photos:
                        break
                except:
                    continue
            
            if photos:
                first_photo = photos[0]
                try:
                    img = first_photo.find_element(By.TAG_NAME, "img")
                    img_url = img.get_attribute("src")
                    return img_url
                except:
                    img_elements = first_photo.find_elements(By.TAG_NAME, "img")
                    if img_elements:
                        return img_elements[0].get_attribute("src")
                    return None
            else:
                print("No photos found in search results, trying Google Images", file=sys.stderr)
                driver.quit()
                return search_google_images(query)
                
        except NoSuchElementException as e:
            print(f"Element not found in Google Photos, falling back to Google Images: {e}", file=sys.stderr)
            driver.quit()
            return search_google_images(query)
            
    except TimeoutException:
        print("Timeout waiting for Google Photos page to load, trying Google Images", file=sys.stderr)
        driver.quit()
        return search_google_images(query)
    except Exception as e:
        print(f"Error during Google Photos search, trying Google Images: {e}", file=sys.stderr)
        driver.quit()
        return search_google_images(query)
    finally:
        if driver: # Ensure driver exists before quit
            driver.quit()

def get_product_image_google_photos(itemcode: str, itemname: str) -> str | None:
    query = itemcode if is_valid_barcode(itemcode) else itemname
    enhanced_query = f"{query} לוגו"
    return search_google_images(enhanced_query)

def get_subchain_image_google_photos(subchainname: str) -> str | None:
    enhanced_query = f"{subchainname} לוגו"
    return search_google_images(enhanced_query)

if __name__ == "__main__":
    time.sleep(random.uniform(1, 3)) # Reduced random delay, original was 6-12s

    mode = sys.argv[1].lower() if len(sys.argv) > 1 else "product"
    url = None # Initialize url
    
    if mode == "subchain":
        subchainname = sys.argv[2] if len(sys.argv) > 2 else ""
        if subchainname:
            url = get_subchain_image_google_photos(subchainname)
        else:
            print("Subchain name not provided for subchain mode.", file=sys.stderr)
    else:  # default to product
        itemcode = sys.argv[2] if len(sys.argv) > 2 else ""
        itemname = sys.argv[3] if len(sys.argv) > 3 else ""
        if itemcode or itemname:
            url = get_product_image_google_photos(itemcode, itemname)
        else:
            print("Item code or item name not provided for product mode.", file=sys.stderr)

    print(url or "")
