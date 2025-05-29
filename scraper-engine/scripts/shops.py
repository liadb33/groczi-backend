import os
import shutil
import logging
import gzip
import zipfile
import time
import sys
import colorama

from pathlib import Path
from datetime import datetime, timedelta
from colorama import Fore, Style

# Selenium Imports
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By 
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver import ActionChains

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.json import load_config
from utils.constants import *
from utils.date import get_file_hour
from utils.selenium import access_site
from utils.filesys import parse_args
from utils.filesys import determine_folder

JSON_FILE_PATH = get_json_file_path("shops.json")

prefs = {
    "download.default_directory": str(GZ_FOLDER_PATH),  # Set the default download directory
    "download.prompt_for_download": False,  # disables the "Save As" dialog
    "download.directory_upgrade": True,
    "safebrowsing.enabled": True  # avoid security prompts
}


def safe_click(driver, element):
    try:
        element.click()
        return
    except:
        pass
    try:
        actions = ActionChains(driver)
        actions.move_to_element(element).click().perform()
        return
    except:
        pass
    try:
        driver.execute_script("arguments[0].scrollIntoView(true);", element)
        time.sleep(0.2)
        driver.execute_script("arguments[0].click();", element)
        return
    except Exception as e:
        print(f"All click methods failed: {e}")
        raise

def wait_for_single_gz_file(folder: Path, timeout: int = 30) -> Path | None:
    """Wait up to timeout seconds until exactly one .gz file exists in folder."""
    end_time = time.time() + timeout
    while time.time() < end_time:
        gz_files = list(folder.glob("*.gz"))
        if len(gz_files) == 1:
            return gz_files[0]
        time.sleep(0.5)
    return None

def extract_file(gz_path: Path, extracted_path: Path):
    with open(gz_path, "rb") as f:
        file_start = f.read(4)

    if file_start.startswith(b'PK'):
        # זה קובץ ZIP
        with zipfile.ZipFile(gz_path, 'r') as zip_ref:
            # מניחים שיש בקובץ ZIP קובץ אחד, מחלץ אותו
            namelist = zip_ref.namelist()
            if len(namelist) != 1:
                logging.warning(f"ZIP file {gz_path} contains multiple files")
            zip_ref.extract(namelist[0], extracted_path.parent)
            # אם רוצים לשנות שם, אפשר להעביר את הקובץ אחרי חילוץ
            extracted_file_path = extracted_path.parent / namelist[0]
            if extracted_file_path != extracted_path:
                extracted_file_path.rename(extracted_path)
    else:
        # מניחים gzip
        with gzip.open(gz_path, "rb") as f_in:
            with open(extracted_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

def download_and_extract(driver: webdriver.Chrome, user: dict):
    username = user.get("username", "").strip()
    config = user.get("config", {})

    file_processed = 0
    try:
        rows = driver.find_elements(By.CSS_SELECTOR, config["row_selector"])
        if not rows:
            logging.warning("No rows found in table - stopping search")
            return
        
        target_hour = (datetime.now()).hour

        for row in rows:
            timestamp_element = row.find_element(By.CSS_SELECTOR, config["timestamp_selector"])
            file_hour = get_file_hour(timestamp_element.text)

            if file_hour != target_hour:
                return
            
            download_link = row.find_element(By.CSS_SELECTOR, config["link_config"])

            #safe_click(driver,download_link)
            #option 1
            # actions = ActionChains(driver)
            # actions.move_to_element(download_link).click().perform()

            #option 2 
            # driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", download_link)
            # download_link.click()
            #option 3
            # href = download_link.get_attribute("href")
            # driver.get(href)

            #option 4
            driver.execute_script("arguments[0].click();", download_link)


            gz_path = wait_for_single_gz_file(Path(GZ_FOLDER_PATH), timeout=60)
            if gz_path is None:
                logging.error("Timeout waiting for .gz file to appear after download")
                continue

            file_name_gz = gz_path.name
            print(f"{Fore.CYAN}⬇️ Downloaded: {file_name_gz}{Style.RESET_ALL}")

            file_name_xml = file_name_gz.replace(".gz", ".xml")

            user_xml_folder = determine_folder(file_name_gz, username)
            extracted_path = user_xml_folder / file_name_xml
            extracted_path.parent.mkdir(parents=True, exist_ok=True)

            extract_file(gz_path, extracted_path)
            
            gz_path.unlink()
            print(f"{Fore.MAGENTA}📦 Extracted & removed: {file_name_gz}{Style.RESET_ALL}")

            file_processed += 1

        if file_processed == 0:
            logging.info("No files found - stopping search")
            return

        next_button = driver.find_element(By.CSS_SELECTOR, config["pagination_selector"])
        if next_button.is_displayed() and next_button.is_enabled():
            table_element = driver.find_element(By.TAG_NAME, "table")
            next_button.click()
            WebDriverWait(driver, 10).until(EC.staleness_of(table_element))
            download_and_extract(driver, user)

    except Exception as e:
        logging.error(f"General error in download_and_extract: {e}")
        return


# === MAIN FLOW ===
def main():
    try:
        config = load_config(JSON_FILE_PATH)
    except Exception:
        logging.critical("Failed to load configuration. Exiting.")
        return
    
    args = parse_args()
    driver = None

    try:
        options = Options()
        options.add_argument("--headless") 
        options.add_experimental_option("prefs", prefs) 
        driver = webdriver.Chrome(options=options)
        
        users = config.get("users", [])
        if not users:
            logging.error("❌ No users found in the configuration.")
            return
        
        if args.user: # filter users by arg username
            users = [u for u in users if u["username"] in args.user]
            if not users:
                logging.warning("⚠️ No matching users found for the provided --user argument(s).")
                return
        
        os.makedirs(GZ_FOLDER_PATH, exist_ok=True)

        for user in users:
                        
            site_url = user.get("url", "").strip()
            if not site_url:
                logging.warning("⚠️ No 'url' found in user entry; skipping.")
                continue
            
            if not access_site(driver, site_url, user["config"]["wait_for_selector"]):
                logging.error(f"Skipping {site_url} due to site access failure.")
                continue

            download_and_extract(driver,user)

    except Exception as e:
        shutil.rmtree(GZ_FOLDER_PATH)
        logging.critical(f"An unexpected error occurred in main: {e}", exc_info=True)
    finally:
        if driver:
            driver.quit()
            

if __name__ == "__main__":
    main()
