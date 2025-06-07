import os
import shutil
import gzip
import zipfile
import time
import sys
from pathlib import Path
from datetime import datetime

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
from utils.filesys import parse_args, determine_folder
from utils.logging import log_info, log_warn, log_error 

JSON_FILE_PATH = get_json_file_path("shops.json")
GZ_FOLDER = Path(GZ_FOLDER_PATH)

# Selenium preferences for downloads
prefs = {
    "download.default_directory": str(GZ_FOLDER),
    "download.prompt_for_download": False,
    "download.directory_upgrade": True,
    "safebrowsing.enabled": True
}

def safe_click(driver, element):
    """Try multiple click methods to safely trigger clicks on a web element."""
    try:
        ActionChains(driver).move_to_element(element).click().perform()
        return
    except Exception:
        pass
    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", element)
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
        raise RuntimeError(f"All click methods failed: {e}")

def wait_for_single_gz_file(folder: Path, timeout: int = 30) -> Path | None:
    """
    Wait until exactly one .gz file appears in the folder or timeout.

    Args:
        folder (Path): directory to watch
        timeout (int): seconds to wait

    Returns:
        Path | None: the .gz file path or None if timed out
    """
    end_time = time.time() + timeout
    while time.time() < end_time:
        gz_files = list(folder.glob("*.gz"))
        if len(gz_files) == 1:
            return gz_files[0]
        time.sleep(0.5)
    return None

def extract_file(gz_path: Path, extracted_path: Path):
    """Extract .gz or .zip archive to the specified path."""
    with open(gz_path, "rb") as f:
        file_start = f.read(4)

    if file_start.startswith(b'PK'):  # zip file magic number
        with zipfile.ZipFile(gz_path, 'r') as zip_ref:
            namelist = zip_ref.namelist()
            zip_ref.extract(namelist[0], extracted_path.parent)
            extracted_file = extracted_path.parent / namelist[0]
            if extracted_file != extracted_path:
                extracted_file.rename(extracted_path)
    else:
        with gzip.open(gz_path, "rb") as f_in:
            with open(extracted_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

def clear_gz_folder(folder: Path):
    """Delete all .gz files in the folder."""
    for f in folder.glob("*.gz"):
        f.unlink()

def download_file(driver, row, config) -> Path | None:
    """
    Download a file if its timestamp hour matches the current hour.

    Args:
        driver (webdriver.Chrome): Selenium driver instance
        row: Selenium element representing a data row
        config (dict): config selectors

    Returns:
        Path | None: downloaded .gz file path or None
    """
    timestamp_element = row.find_element(By.CSS_SELECTOR, config["timestamp_selector"])
    file_hour = get_file_hour(timestamp_element.text)
    if file_hour != datetime.now().hour:
        return None

    download_link = row.find_element(By.CSS_SELECTOR, config["link_config"])
    clear_gz_folder(GZ_FOLDER)
    safe_click(driver, download_link)

    return wait_for_single_gz_file(GZ_FOLDER, timeout=60)

def process_downloaded_file(gz_path: Path, username: str):
    """
    Extract the downloaded file and move it to the user folder.

    Args:
        gz_path (Path): path to the .gz file
        username (str): user identifier
    """
    file_name_gz = gz_path.name
    file_name_xml = file_name_gz.replace(".gz", ".xml")
    output_folder = determine_folder(file_name_gz, username)
    extracted_path = output_folder / file_name_xml
    extracted_path.parent.mkdir(parents=True, exist_ok=True)

    extract_file(gz_path, extracted_path)
    gz_path.unlink()

    log_info(f"⬇️ Downloaded: {file_name_gz}")
    log_info(f"📦 Extracted & removed: {file_name_gz}")

def download_and_extract(driver: webdriver.Chrome, user: dict):
    """
    Download and extract files for a single user, handle pagination.

    Args:
        driver (webdriver.Chrome): Selenium WebDriver
        user (dict): user config
    """
    username = user.get("username", "").strip()
    config = user.get("config", {})
    rows = driver.find_elements(By.CSS_SELECTOR, config["row_selector"])

    if not rows:
        log_warn("No rows found - stopping.")
        return

    processed = 0
    for row in rows:
        gz_path = download_file(driver, row, config)
        if gz_path:
            process_downloaded_file(gz_path, username)
            processed += 1

    if processed == 0:
        log_warn("No matching files found.")
        return

    try:
        next_button = driver.find_element(By.CSS_SELECTOR, config["pagination_selector"])
        if next_button.is_displayed() and next_button.is_enabled():
            table = driver.find_element(By.TAG_NAME, "table")
            next_button.click()
            WebDriverWait(driver, 10).until(EC.staleness_of(table))
            download_and_extract(driver, user)
    except Exception:
        pass  # No next page or unable to navigate

def main():
    try:
        config = load_config(JSON_FILE_PATH)
    except Exception:
        log_error("Failed to load configuration.")
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
            log_error("No users in config.")
            return

        if args.user:
            users = [u for u in users if u["username"] in args.user]
            if not users:
                log_warn("No matching users for --user.")
                return

        os.makedirs(GZ_FOLDER, exist_ok=True)

        for user in users:
            site_url = user.get("url", "").strip()
            if not site_url:
                log_warn("User missing 'url'. Skipping.")
                continue

            if not access_site(driver, site_url, user["config"]["wait_for_selector"]):
                log_error(f"Failed to access {site_url}")
                continue

            download_and_extract(driver, user)

    except Exception as e:
        log_error(f"Unexpected error: {e}")
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    main()
