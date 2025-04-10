import os
import json
import shutil
import logging
from pathlib import Path
import requests
import gzip
from datetime import datetime
from urllib.parse import urlparse

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
DOWNLOAD_FOLDER = SCRIPT_DIR.parent / "files" / "gzFiles"

# Define the two extraction folders that will be used.
extract_folder_citymarket = SCRIPT_DIR.parent / "files" / "xmlFilesCityMarket"
extract_folder_hazihinam = SCRIPT_DIR.parent / "files" / "xmlFilesHaziHinam"

# Logging Setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%d/%m/%Y %H:%M'
)
logging.info(f"Looking for JSON file at: {SHOPS_JSON_FILE.resolve()}")

# === HELPER FUNCTIONS ===

def load_shops_json(file_path: Path) -> dict:
    """Loads the JSON file containing the list of site URLs."""
    if not file_path.exists():
        raise FileNotFoundError(f"Could not find JSON file at {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def normalize_download_url(url: str, base_url: str) -> str:
    """
    If the download URL is relative (starting with "/downloadFile/"),
    prepend the provided base_url (from JSON) to build the full URL.
    Otherwise, return the URL unchanged.
    """
    if url.startswith("http"):
        return url
    elif url.startswith("/downloadFile/"):
        return base_url.rstrip('/') + url
    else:
        return url

def access_site(driver: webdriver.Chrome, url: str) -> bool:
    """
    Opens the given URL in Selenium.
    Waits until the page loads by checking for either a table with class "table-striped"
    or the <body> tag.
    Returns True if the page loads successfully.
    """
    logging.info(f"Accessing site: {url}")
    try:
        driver.get(url)
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "table.table-striped"))
            )
            logging.info("✅ Found table with class 'table-striped'.")
        except Exception:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            logging.info("✅ Found <body> element.")
        return True
    except Exception as e:
        logging.error(f"❌ Error accessing {url}: {e}")
        return False

def fetch_file_list(driver: webdriver.Chrome) -> list:
    """
    Extracts file entries from the table on the page.
    Detects the layout by the number of cells in a row:
      - 7 cells: City Market layout.
      - 6 cells: Hazihinam layout.
    Returns a list of dictionaries containing:
      date, time, shop, file_name, file_type, full_partial (empty for Hazihinam),
      size_kb, and download_url.
    """
    results = []
    try:
        table = driver.find_element(By.CSS_SELECTOR, "table.table-striped")
        tbody = table.find_element(By.TAG_NAME, "tbody")
        rows = tbody.find_elements(By.TAG_NAME, "tr")
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, "td")
            if len(cells) == 7:
                # City Market layout
                spans = cells[0].find_elements(By.TAG_NAME, "span")
                if len(spans) < 2:
                    continue
                date_text = spans[0].text.strip()
                time_text = spans[1].text.strip()
                shop = cells[1].text.strip()
                file_name = cells[2].text.strip()
                file_type = cells[3].text.strip()
                full_partial = cells[4].text.strip()
                size_kb = cells[5].text.strip()
                try:
                    download_link = cells[6].find_element(By.TAG_NAME, "a").get_attribute("href")
                except Exception:
                    download_link = ""
                results.append({
                    "date": date_text,
                    "time": time_text,
                    "shop": shop,
                    "file_name": file_name,
                    "file_type": file_type,
                    "full_partial": full_partial,
                    "size_kb": size_kb,
                    "download_url": download_link
                })
            elif len(cells) == 6:
                # Hazihinam layout
                spans = cells[0].find_elements(By.TAG_NAME, "span")
                if len(spans) < 2:
                    continue
                date_text = spans[0].text.strip()
                time_text = spans[1].text.strip()
                store_code = cells[1].text.strip()
                file_name = cells[2].text.strip()
                file_type = cells[3].text.strip()
                size_kb = cells[4].text.strip()
                try:
                    download_link = cells[5].find_element(By.TAG_NAME, "a").get_attribute("href")
                except Exception:
                    download_link = ""
                results.append({
                    "date": date_text,
                    "time": time_text,
                    "shop": store_code,  # use the store code
                    "file_name": file_name,
                    "file_type": file_type,
                    "full_partial": "",
                    "size_kb": size_kb,
                    "download_url": download_link
                })
            else:
                continue  # Unrecognized layout
        logging.info(f"✅ Found {len(results)} file entries in total.")
    except Exception as e:
        logging.error(f"❌ Error fetching file list: {e}")
    return results

def download_and_extract(file_links: list[str], session: requests.Session, destination_folder: Path, base_url: str):
    """
    Downloads files from the provided URLs.
    If a file appears gzipped (by filename or Content-Type header),
    decompress it to extract the underlying XML file and save it in destination_folder.
    If the file is XML, move it directly to destination_folder.
    """
    os.makedirs(destination_folder, exist_ok=True)
    os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

    for link in file_links:
        temp_file_path = None
        try:
            full_link = normalize_download_url(link, base_url)
            filename = full_link.split("/")[-1]
            temp_file_path = DOWNLOAD_FOLDER / filename

            logging.info(f"⬇️ Downloading: {full_link}")
            resp = session.get(full_link, stream=True, timeout=60)
            resp.raise_for_status()
            with open(temp_file_path, "wb") as f:
                shutil.copyfileobj(resp.raw, f)

            content_type = resp.headers.get("Content-Type", "").lower()
            logging.info(f"Content-Type: {content_type}")

            if filename.lower().endswith(".gz") or "gzip" in content_type:
                xml_filename = filename[:-3] if filename.lower().endswith(".gz") else filename + ".xml"
                xml_file_path = destination_folder / xml_filename
                logging.info(f"📦 Decompressing gz file {filename} to {xml_filename}")
                with gzip.open(temp_file_path, 'rb') as f_in, open(xml_file_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
                logging.info(f"✅ Successfully decompressed to {xml_filename}.")
            elif filename.lower().endswith(".xml") or "xml" in content_type:
                xml_file_path = destination_folder / filename
                logging.info(f"✅ Downloaded XML file; moving to {destination_folder}.")
                shutil.move(str(temp_file_path), xml_file_path)
            else:
                logging.info(f"✅ Downloaded file {filename} not recognized as gzipped or XML; leaving it in place.")
        except RequestException as dl_err:
            logging.error(f"❌ Request/Download error: {dl_err}")
        except Exception as e:
            logging.error(f"❌ Unexpected error processing {link}: {e}")
        finally:
            if temp_file_path and temp_file_path.exists():
                try:
                    temp_file_path.unlink()
                except Exception as cleanup_err:
                    logging.error(f"Failed cleaning up {temp_file_path}: {cleanup_err}")

# === MAIN FLOW ===
def main():
    try:
        shops_data = load_shops_json(SHOPS_JSON_FILE)
    except Exception as e:
        logging.critical(f"Could not load shops.json: {e}")
        return

    os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)
    
    logging.info("Initializing WebDriver (Chrome headless)...")
    options = Options()
    options.add_argument("--headless")
    driver = None
    try:
        driver = webdriver.Chrome(options=options)
        logging.info("WebDriver initialized.")
        session = requests.Session()
        
        for user_config in shops_data.get("users", []):
            site_url = user_config.get("url", "").strip()
            if not site_url:
                logging.warning("⚠️ No 'url' found in user entry; skipping.")
                continue

            logging.info(f"\n===== PROCESSING: {site_url} =====")
            if not access_site(driver, site_url):
                logging.error(f"Skipping {site_url} due to site access failure.")
                continue

            base_url = site_url.rstrip('/')  # Use the site's URL from JSON as base.

            # Determine extraction folder based on URL.
            if "citymarket-shops" in site_url:
                output_folder = extract_folder_citymarket
            elif "hazi-hinam" in site_url:
                output_folder = extract_folder_hazihinam
            else:
                logging.warning(f"Site {site_url} not recognized; skipping.")
                continue

            logging.info(f"Saving files for site to: {output_folder}")
            file_entries = fetch_file_list(driver)

            # Filter for files from the current hour.
            current_hour = datetime.now().hour
            filtered_entries = []
            for entry in file_entries:
                try:
                    file_hour = int(entry["time"].split(":")[0])
                    if file_hour == current_hour:
                        filtered_entries.append(entry)
                except Exception as err:
                    logging.error(f"Error parsing time '{entry.get('time')}' for file '{entry.get('file_name')}': {err}")
            logging.info(f"Filtered entries: {len(filtered_entries)} file(s) match the current hour ({current_hour}).")

            download_links = [item["download_url"] for item in filtered_entries if item["download_url"]]
            logging.info(f"Found {len(download_links)} download link(s) after filtering by current hour.")
            
            if download_links:
                download_and_extract(download_links, session, output_folder, base_url)
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
