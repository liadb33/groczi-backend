import os
import json
import shutil
import logging
from pathlib import Path
import requests
import gzip
from datetime import datetime
from urllib.parse import urlparse
from selenium.common.exceptions import WebDriverException, TimeoutException
# Selenium Imports
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By 
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from requests.exceptions import RequestException

# === PATHS AND CONSTANTS ===
SCRIPT_DIR = Path(__file__).parent.resolve()
SHOPS_JSON_FILE = SCRIPT_DIR.parent / "jsons" / "shop.json"
GZ_FOLDER_PATH = SCRIPT_DIR.parent / "files" / "gzFiles"

# Define the two extraction folders that will be used.
XML_FOLDER_PATH = SCRIPT_DIR.parent / "files" / "xmlFiles"

# Logging Setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%d/%m/%Y %H:%M'
)
logging.info(f"Looking for JSON file at: {SHOPS_JSON_FILE.resolve()}")

# === HELPER FUNCTIONS ===

def load_config(file_path: str | Path) -> dict:
    """Loads and returns the configuration JSON."""
    try:
        with open(file_path, "r", encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.error(f"❌ Configuration file not found: '{file_path}'")
        raise
    except json.JSONDecodeError as e:
        logging.error(f"❌ Failed to decode JSON from '{file_path}': {e}")
        raise
    except Exception as e:
        logging.error(f"❌ Failed to load config '{file_path}': {type(e).name} - {e}")
        raise

def access_site(driver: webdriver.Chrome, url: str) -> bool:
  
    logging.info(f"Accessing site: {url}")
    
    try:
        driver.get(url)
        WebDriverWait(driver, 60).until(EC.presence_of_element_located((By.CSS_SELECTOR, "table")))
        logging.info(f"✅ Found table.")
        return True
    except TimeoutException:
        logging.error(f"❌ Timed out waiting for site confirmation")
        return False
    except WebDriverException as e:
        logging.error(f"❌ Site access failed {e}")
        return False    
    except Exception as e:
        logging.error(f"❌ Error accessing {url}: {e}")
        return False

def fetch_all_file_entries(driver,base_url: str,config: dict) -> list:
    results = []
    res = fetch_file_list(driver,base_url,results,config)
    while not res:
        try:
            page_il = driver.find_element(By.CSS_SELECTOR, config["pagination_selector"])
            if page_il:
                page_il.click()
                WebDriverWait(driver, 10).until(EC.staleness_of(driver.find_element(By.TAG_NAME, "table")))
            else:
                break
        except Exception as e:
            logging.info("No next page found or error clicking next page; ending pagination.")
            break
    return results
     
def fetch_file_list(driver: webdriver.Chrome,base_url: str,results: list,config: dict) -> bool:
    try:
        rows = driver.find_elements(By.CSS_SELECTOR, config["row_selector"])
        current_hour = datetime.now().hour
        for row in rows:            
            timestamp = row.find_element(By.CSS_SELECTOR, config["timestamp_selector"])
            file_hour = get_file_hour(timestamp.text)  
            if file_hour != current_hour:
                return True
            download_link = row.find_element(By.CSS_SELECTOR, config["link_config"]).get_attribute("href")
            if not download_link.startswith("http"):
                download_link = base_url + download_link
            results.append(download_link)
    except Exception as e:
         logging.error(f"❌ Error fetching file list: {e}")
         return False
    return False

def get_file_hour(timestamp_text: str) -> int:
    
    formats = [
        "%H:%M",                      
        "%m/%d/%Y %I:%M:%S %p"
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(timestamp_text, fmt)
            return dt.hour
        except ValueError:
            continue
    raise ValueError(f"Unrecognized timestamp format: {timestamp_text}")


def download_and_extract(file_links: list[str], session: requests.Session, user_xml_folder: str | Path):
    """Downloads GZ files, extracts them to XML in the user's folder, and removes the GZ."""
    
    os.makedirs(user_xml_folder, exist_ok=True)
    os.makedirs(GZ_FOLDER_PATH, exist_ok=True) 

    for file_link in file_links:
        try:
            file_name_gz = file_link.split("/")[-1].split("?")[0]  # Extract the file name from the URL

            gz_path = Path(GZ_FOLDER_PATH) / file_name_gz
            file_name_xml = file_name_gz + ".xml" 
            extracted_path = Path(user_xml_folder) / file_name_xml
            logging.info(f"⬇️ Downloading: {file_link}")
            response = session.get(file_link, stream=True)
            response.raise_for_status() 

            with open(gz_path, "wb") as f:
                shutil.copyfileobj(response.raw, f)

            logging.info(f"📦 Extracting:")
            with gzip.open(gz_path, "rb") as f_gzip:
                with open(extracted_path, "wb") as f_xml:
                    shutil.copyfileobj(f_gzip, f_xml)

            os.remove(gz_path) 
            logging.info(f"✅ Done & Cleaned: {file_name_gz}")

        except RequestException as e:
            logging.error(f"❌ Download failed for {file_link}: {e}")
        except OSError as e:
            logging.error(f"❌ File/Extract error for {file_name_gz} (Link: {file_link}): {e}")
        except Exception as e:
            logging.error(f"❌ Unexpected error processing {file_link}: {type(e).__name__} - {e}")

# === MAIN FLOW ===
def main():
    try:
        config = load_config(SHOPS_JSON_FILE)
    except Exception:
        logging.critical("Failed to load configuration. Exiting.")
        return
    
    driver = None
    try:
        logging.info("Initializing WebDriver")
        options = Options()
        options.add_argument("--headless")
        driver = webdriver.Chrome(options=options)
        logging.info("WebDriver initialized.")
        session = requests.Session()
        users = config.get("users", [])
        for user in users:
            site_url = user.get("url", "").strip()
            if not site_url:
                logging.warning("⚠️ No 'url' found in user entry; skipping.")
                continue

            logging.info(f"\n===== PROCESSING: {site_url} =====")
            if not access_site(driver, site_url):
                logging.error(f"Skipping {site_url} due to site access failure.")
                continue

            file_list_items = fetch_all_file_entries(driver,site_url,user["config"])

            if file_list_items:
                user_xml_folder_path = XML_FOLDER_PATH / user.get("username", "")
                os.makedirs(user_xml_folder_path, exist_ok=True) # Ensure folder exists here
                download_and_extract(file_list_items, session,user_xml_folder_path)
            else:
                logging.info("No downloadable files found for this site in the current hour.")
            logging.info(f"===== FINISHED: {site_url} =====")
    except Exception as e:
        logging.critical(f"An unexpected error occurred in main: {e}", exc_info=True)
    finally:
        if driver:
            logging.info("Closing WebDriver...")
            driver.quit()
            logging.info("WebDriver closed.")

if __name__ == "__main__":
    main()
