import os
import sys
import time
import gzip
import shutil
import zipfile

from pathlib import Path
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver import ActionChains

# Utils imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.json     import load_config
from utils.constants import *
from utils.date     import get_file_hour
from utils.selenium import access_site
from utils.filesys  import parse_args, determine_folder, extract_file
from utils.logging  import log_info, log_success, log_warn, log_error, log_critical

# Record script start time
SCRIPT_START      = datetime.now()
SCRIPT_START_HOUR = SCRIPT_START.hour

# Paths and Selenium download preferences
JSON_FILE_PATH = get_json_file_path("shops.json")
GZ_FOLDER      = Path(GZ_FOLDER_PATH)
CHROME_PREFS   = {
    "download.default_directory": str(GZ_FOLDER),
    "download.prompt_for_download": False,
    "download.directory_upgrade": True,
    "safebrowsing.enabled": True
}

def safe_click(driver, element):
    try:
        ActionChains(driver).move_to_element(element).click().perform()
        return
    except Exception:
        pass
    try:
        driver.execute_script(
            "arguments[0].scrollIntoView({block: 'center', inline: 'center'});",
            element
        )
        time.sleep(0.2)
        element.click()
        return
    except Exception:
        pass
    try:
        href = element.get_attribute("href")
        if href:
            driver.get(href)
            return
    except Exception:
        pass
    try:
        driver.execute_script("arguments[0].click();", element)
    except Exception as e:
        log_error(f"Click failed: {e}")
        raise

def wait_for_single_gz_file(folder: Path, timeout: int = 30) -> Path | None:
    end_time = time.time() + timeout
    while time.time() < end_time:
        gz_files = list(folder.glob("*.gz"))
        if len(gz_files) == 1:
            return gz_files[0]
        time.sleep(0.5)
    return None

def clear_gz_folder(folder: Path):
    for f in folder.glob("*.gz"):
        f.unlink()

def download_file(driver, row, config) -> Path | None:
    ts_el = row.find_element(By.CSS_SELECTOR, config.get("timestamp_selector", ""))
    if get_file_hour(ts_el.text) != SCRIPT_START_HOUR:
        return None

    link_el = row.find_element(By.CSS_SELECTOR, config.get("link_config", ""))
    clear_gz_folder(GZ_FOLDER)
    safe_click(driver, link_el)
    return wait_for_single_gz_file(GZ_FOLDER, timeout=60)

def download_and_extract(driver: webdriver.Chrome, user: dict):
    username = user.get("username", "").strip()
    log_info(f"     🗃 Starting downloads for user: {username}")
    config   = user.get("config", {})

    while True:
        rows = driver.find_elements(By.CSS_SELECTOR, config.get("row_selector", ""))
        if not rows:
            log_warn(f"No rows found for user {username}")
            break

        successes = 0
        failures   = []

        for row in rows:
            try:
                gz_path = download_file(driver, row, config)
                if not gz_path:
                    if not successes:
                        log_warn(f"No matching files found for user {username}")
                    return

                start      = time.time()
                file_name  = gz_path.name
                output_dir = determine_folder(file_name, username)
                os.makedirs(output_dir, exist_ok=True)

                xml_name      = file_name.replace('.gz', '.xml')
                extracted_path = Path(output_dir) / xml_name

                extract_file(gz_path, extracted_path)    # <-- shared util
                gz_path.unlink()

                elapsed = time.time() - start
                log_success(f"✅ {file_name} downloaded & extracted in {elapsed:.2f}s")
                successes += 1
            except Exception as e:
                log_error(f"❌ Failed processing file for user {username}: {e}")
                failures.append(str(e))

        if successes == 0:
            log_warn(f"No matching files found for user {username}")
        if failures:
            log_warn(f"Some errors occurred for user {username}:")
            for err in failures:
                log_error(f" - {err}")

        # pagination logic
        try:
            next_btn = driver.find_element(By.CSS_SELECTOR, config.get("pagination_selector", ""))
            if next_btn.is_displayed() and next_btn.is_enabled():
                table = driver.find_element(By.TAG_NAME, "table")
                next_btn.click()
                WebDriverWait(driver, 10).until(EC.staleness_of(table))
                # loop will repeat for the new page automatically
            else:
                break  # no next page, exit loop
        except Exception:
            break  # no pagination found or error, exit loop


def main():
    args = parse_args()
    try:
        config = load_config(JSON_FILE_PATH)
    except Exception:
        log_critical("Failed to load configuration. Exiting.")
        return

    users = config.get("users", [])
    if args.user:
        users = [u for u in users if u.get("username") in args.user]
        if not users:
            log_warn("No matching users for provided --user argument(s).")
            return

    os.makedirs(GZ_FOLDER, exist_ok=True)
    options = Options()
    options.add_argument("--headless")
    options.add_experimental_option("prefs", CHROME_PREFS)
    options.add_argument("--ignore-certificate-errors")
    options.set_capability("acceptInsecureCerts", True)

    driver = webdriver.Chrome(options=options)
    for user in users:
        name = user.get("username", "").strip()
        url  = user.get("url", "").strip()
        if not url:
            log_warn(f"Missing URL for user {name}, skipping.")
            continue
        if not access_site(driver, url, user.get("config", {}).get("wait_for_selector", "")):
            log_error(f"Failed to access {url} for user {name}")
            continue
        download_and_extract(driver, user)

    driver.quit()

if __name__ == "__main__":
    main()
