import os
import shutil
import logging
import gzip
import zipfile
import time
from pathlib import Path
from datetime import datetime
# Selenium Imports
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By 
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from utils.json import load_config
from utils.constants import *
from utils.date import get_file_hour
from utils.selenium import access_site

JSON_FILE_PATH = get_json_file_path("cerberus.json")

prefs = {
    "download.default_directory": str(GZ_FOLDER_PATH),  # Set the default download directory
    "download.prompt_for_download": False,  # disables the "Save As" dialog
    "download.directory_upgrade": True,
    "safebrowsing.enabled": True  # avoid security prompts
}

def fetch_all_file_entries(driver: webdriver.Chrome, config: dict) -> bool:
    overall_success = True
    # Try to collect files from current page
    page_result = fetch_file_list(driver, config)
    
    # If return is True, we're done (found a file outside desired hour range)
    while not page_result:
        try:
            # Try to find button for next page
            page_element = driver.find_element(By.CSS_SELECTOR, config["pagination_selector"])
            
            # Check if button exists and is accessible
            if page_element and page_element.is_displayed() and page_element.is_enabled():
                page_element.click()
                
                WebDriverWait(driver, 10).until(
                    EC.staleness_of(driver.find_element(By.TAG_NAME, "table"))
                )
                
                page_success = fetch_file_list(driver, config)
                overall_success = overall_success and page_success
                
                # If we found a file outside the hour range, end the search
                if page_success:
                    break
            else:
                logging.info("Reached last page (no next page button found)")
                break
        except Exception as e:
            logging.info(f"End of page navigation: {e}")
            break
    
    return overall_success
     
def fetch_file_list(driver: webdriver.Chrome, config: dict) -> bool:
    try:
        # Find all rows in the table
        rows = driver.find_elements(By.CSS_SELECTOR, config["row_selector"])
        if not rows:
            logging.warning("⚠️ No rows found in table")
            return False
        
        # Set current hour minus one hour
        current_hour = datetime.now().hour - 1
        files_processed = 0
        
        for row in rows:
            try:
                # Extract timestamp
                timestamp = row.find_element(By.CSS_SELECTOR, config["timestamp_selector"])
                file_hour = get_file_hour(timestamp.text)
                
                # Check if file is from previous hour
                if file_hour != current_hour:
                    return True  # Found file outside hour range - end search
                
                # Click download link
                download_link = row.find_element(By.CSS_SELECTOR, config["link_config"])
                download_link.click()
                logging.info(f"⬇️ Downloading file from hour: {timestamp.text}")
                
                # Wait for download completion
                if not wait_for_download_complete(GZ_FOLDER_PATH):
                    logging.warning(f"⚠️ Download did not complete within timeout for: {timestamp.text}")
                
                files_processed += 1
            except Exception as e:
                logging.error(f"❌ Error processing table row: {e}")
        
        logging.info(f"✅ Total of {files_processed} files processed in current page")
        
        # Return False to continue to next page if files were processed and no out-of-range file found
        return files_processed == 0
    except Exception as e:
        logging.error(f"❌ Error fetching file list: {e}")
        return False

def wait_for_download_complete(folder: Path, timeout: int = 60) -> bool:
    logging.info("⏳ Waiting for download to complete...")
    elapsed = 0
    while elapsed < timeout:
        files = list(folder.glob("*.crdownload"))
        if not files:
            logging.info("✅ Download finished.")
            return True
        time.sleep(1)
        elapsed += 1
    logging.warning("⚠️ Download may not have completed in time.")
    return False

def extract(username: str) -> None:
    """Extracts .gz or .zip files from GZ_FOLDER_PATH to the given folder."""
    
    gz_files = list(Path(GZ_FOLDER_PATH).glob("*.gz"))
    if not gz_files:
        logging.warning("⚠️ No .gz files found to extract.")
        return
    
    for gz_path in gz_files:
        try:
            with open(gz_path, "rb") as f:
                magic = f.read(2)
                f.seek(0)  # Reset file pointer

                file_name_gz = gz_path.name
                
                user_xml_folder = (
                    XML_FOLDER_GROCERY_PATH if "price" in file_name_gz.lower() else
                    XML_FOLDER_STORE_PATH if "store" in file_name_gz.lower() else
                    XML_FOLDER_PROMOTION_PATH if "promo" in file_name_gz.lower() else
                    XML_OTHERS_FOLDER_PATH
                )

                file_name_xml = file_name_gz + ".xml"
                extracted_path = user_xml_folder / username / file_name_xml
                extracted_path.parent.mkdir(parents=True, exist_ok=True)

                if magic == b'\x1f\x8b':  # GZIP magic number
                    with gzip.open(f, "rb") as f_gzip, open(extracted_path, "wb") as f_xml:
                        shutil.copyfileobj(f_gzip, f_xml)

                elif magic == b'PK':  # ZIP file magic number
                    with zipfile.ZipFile(f) as z:
                        for zipped_file in z.namelist():
                            # Extract the first file in the zip
                            with z.open(zipped_file) as zip_file, open(extracted_path, 'wb') as out_file:
                                shutil.copyfileobj(zip_file, out_file)

                else:
                    raise ValueError("Unknown file format")

            logging.info(f"✅ Extracted & removed: {file_name_gz}") 
        except Exception as e:
            logging.error(f"❌ Failed to extract {gz_path}: {type(e).__name__} - {e}")

# === MAIN FLOW ===
def main():
    try:
        config = load_config(JSON_FILE_PATH)
    except Exception:
        logging.critical("Failed to load configuration. Exiting.")
        return
    
    driver = None
    try:
        options = Options()
        options.add_argument("--headless") 
        options.add_experimental_option("prefs", prefs) 
        driver = webdriver.Chrome(options=options)
        
        users = config.get("users", [])
        for user in users:
            os.makedirs(GZ_FOLDER_PATH, exist_ok=True)
            
            site_url = user.get("url", "").strip()
            if not site_url:
                logging.warning("⚠️ No 'url' found in user entry; skipping.")
                continue
            
            if not access_site(driver, site_url, user["config"]["wait_for_selector"]):
                logging.error(f"Skipping {site_url} due to site access failure.")
                continue

            fetch_all_file_entries(driver,user["config"])
            extract(user.get("username", ""))
            
            shutil.rmtree(GZ_FOLDER_PATH)
            logging.info(f"===== FINISHED: {site_url} =====")
    except Exception as e:
        shutil.rmtree(GZ_FOLDER_PATH)
        logging.critical(f"An unexpected error occurred in main: {e}", exc_info=True)
    finally:
        if driver:
            logging.info("Closing WebDriver...")
            driver.quit()
            logging.info("WebDriver closed.")

if __name__ == "__main__":
    main()
