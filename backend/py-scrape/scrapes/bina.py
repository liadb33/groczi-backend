import os
import json
import gzip
import shutil
import requests
from datetime import datetime
from pathlib import Path
import logging
from urllib.parse import urlencode 
from zipfile import ZipFile, BadZipFile
from selenium import webdriver
from selenium.webdriver.common.by import By 
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from requests.exceptions import RequestException
from selenium.common.exceptions import WebDriverException, TimeoutException 

# === CONFIG ===
SCRIPT_DIR = Path(__file__).parent.resolve()
# paths relative to the script's directory
JSON_FILE_PATH = SCRIPT_DIR.parent / "jsons" / "bina.json" 
GZ_FOLDER_PATH = SCRIPT_DIR.parent / "files" / "gzFiles"
XML_FOLDER_PATH = SCRIPT_DIR.parent / "files" / "xmlFilesBina"

# --- Global variables to be populated by config ---
DOMAIN_SUFFIX = None
MAIN_PAGE_PATH = None
FILE_LIST_PATH = None
DOWNLOAD_PATH_TEMPLATE = None
DOWNLOAD_TIMEOUT_SECONDS = 60 


# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%d/%m/%Y %H:%M'  
)

# === FILE DOWNLOAD AND EXTRACTION ===
def download_and_extract(file_links: list[str], session: requests.Session, user_xml_folder: str | Path): 
    """Downloads archives (expected ZIP), extracts contents to the user's folder, and removes the archive."""
    os.makedirs(user_xml_folder, exist_ok=True)
    os.makedirs(GZ_FOLDER_PATH, exist_ok=True) 

    for file_link in file_links:
        archive_temp_path = None # Define variable to hold the path for cleanup
        try:
            # Determine expected filename from link (still might end in .gz)
            if DOWNLOAD_PATH_TEMPLATE.endswith("="):
                original_filename = file_link.split("=")[-1]
            else:
                original_filename = file_link.split("/")[-1]

            archive_temp_path = Path(GZ_FOLDER_PATH) / original_filename

            # --- Download the file ---
            logging.info(f"⬇️ Downloading: {file_link}")
            response = session.get(file_link, stream=True, timeout=DOWNLOAD_TIMEOUT_SECONDS)
            response.raise_for_status()

            with open(archive_temp_path, "wb") as f_archive:
                shutil.copyfileobj(response.raw, f_archive)

            # --- Extract using ZipFile ---
            logging.info(f"📦 Attempting ZIP extraction")
            try:
                with ZipFile(archive_temp_path, 'r') as zip_ref:
                    # Extract all files within the ZIP archive into the user's XML folder
                    zip_ref.extractall(path=user_xml_folder)
                    extracted_files = zip_ref.namelist() # Get names of extracted files
                    logging.info(f"✅ Extracted (ZIP)")

            except BadZipFile:
                # If it's somehow NOT a zip file after all
                logging.error(f"❌ File downloaded from {file_link} is not a valid ZIP archive.")
                continue 
            except Exception as zip_err:
                logging.error(f"❌ Error during ZIP extraction for {archive_temp_path}: {zip_err}")
                continue

            # --- Cleanup ---
            logging.info(f"✅ Cleaning up downloaded archive: {archive_temp_path}")
            archive_temp_path.unlink() # Remove the downloaded zip/gz file

        except RequestException as e:
            logging.error(f"❌ Download failed for {file_link}: {e}")
        except OSError as e:
            # Filesystem errors (saving download, creating dirs, etc.)
            logging.error(f"❌ File system error processing link {file_link}: {e}")
        except Exception as e:
            logging.error(f"❌ Unexpected error processing {file_link}: {type(e).__name__} - {e}")
        finally:
            # Ensure cleanup even if extraction fails but download succeeded
            if archive_temp_path and archive_temp_path.exists():
                 try:
                     logging.warning(f"Performing cleanup for {archive_temp_path} after potential error.")
                     archive_temp_path.unlink()
                 except OSError as cleanup_err:
                     logging.error(f"Failed to cleanup archive {archive_temp_path}: {cleanup_err}")

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
        logging.error(f"❌ Failed to load config '{file_path}': {type(e).__name__} - {e}")
        raise

# Renamed for clarity, handles accessing the user-specific site
def access_user_site(driver: webdriver.Chrome, username: str) -> bool:
    """Accesses the user-specific site using Selenium."""
    # Construct the URL using global config vars
    if not all([DOMAIN_SUFFIX, MAIN_PAGE_PATH]):
         logging.error("Domain suffix or main page path not configured globally.")
         return False
    user_url = f"https://{username}{DOMAIN_SUFFIX}{MAIN_PAGE_PATH}"

    logging.info(f"Accessing site for {username} at {user_url}")
    try:
        driver.get(user_url)
        WebDriverWait(driver, 20).until(EC.url_contains("/Main"))
        logging.info(f"✅ Site accessed successfully for {username}")
        return True
    except TimeoutException:
        logging.error(f"❌ Timed out waiting for site confirmation for {username} at {user_url}")
        return False
    except WebDriverException as e:
        logging.error(f"❌ Site access failed for {username}: {e}")
        return False

# Keep transfer_cookies - it might still be useful for session state
def transfer_cookies(driver: webdriver.Chrome, session: requests.Session):
    """Transfers cookies from Selenium WebDriver to requests Session."""
    logging.debug("Transferring cookies from WebDriver to requests session...")
    selenium_cookies = driver.get_cookies()
    for cookie in selenium_cookies:
        session.cookies.set(cookie['name'], cookie['value'], domain=cookie.get('domain'), path=cookie.get('path'))
    logging.debug(f"Transferred {len(selenium_cookies)} cookies.")

# fetch_file_list adapted for Bina's GET request
def fetch_file_list(session: requests.Session, username: str) -> list | None:
    """Fetches the list of files via GET request for Bina."""
    if not all([DOMAIN_SUFFIX, FILE_LIST_PATH]):
         logging.error("Domain suffix or file list path not configured globally.")
         return None

    # Construct base URL and file list URL
    user_base_url = f"https://{username}{DOMAIN_SUFFIX}"
    file_list_url = f"{user_base_url}{FILE_LIST_PATH}"

    ts = int(datetime.timestamp(datetime.now()) * 1000)
    date_str = datetime.now().strftime("%d/%m/%Y")
    params = {
        "_": ts,
        "WStore": "", 
        "WDate": date_str, 
        "WFileType": "0" 
    }
    logging.info(f"Fetching file list from {file_list_url} with params: {params}")



    try:
        response = session.get(file_list_url, params=params, timeout=30) 
        response.raise_for_status()
        file_data = response.json()
        logging.debug(f"Raw file list response: {file_data}")

        # Handle response structure (might be list or dict with aaData)
        file_list_items = None
        if isinstance(file_data, list):
             file_list_items = file_data
             logging.info(f"Found {len(file_list_items)} file entries (raw list).")
        elif isinstance(file_data, dict) and 'aaData' in file_data:
             file_list_items = file_data['aaData']
             logging.info(f"Found {len(file_list_items)} file entries (in aaData).")
        else:
             logging.error(f"Unexpected JSON structure received from file list endpoint: {file_data}")
             return None

        if not file_list_items:
             logging.info("No files found matching criteria.")
             return [] 

        return file_list_items

    except RequestException as e:
        logging.error(f"Failed GET request to fetch file list: {e}")
        return None
    except json.JSONDecodeError as e:
        logging.error(f"Failed to decode JSON response from file list endpoint: {e} - Response text: {response.text[:500]}")
        return None


def is_item_from_current_hour(item: dict, current_hour: int) -> bool:
    """Checks if a file item dictionary has a timestamp matching the current hour."""
    if not isinstance(item, dict):
        return False

    hour_str = int(item.get("DateFile").split(':')[0])
    return hour_str == current_hour 
    
    
# === MAIN ORCHESTRATION ===
def main():
    """Main script execution flow."""
    # --- Setup ---
    global DOMAIN_SUFFIX, MAIN_PAGE_PATH, FILE_LIST_PATH, DOWNLOAD_PATH_TEMPLATE, DOWNLOAD_TIMEOUT_SECONDS
    try:
        config = load_config(JSON_FILE_PATH)
    except Exception:
        logging.critical("Failed to load configuration. Exiting.")
        return

    settings = config.get("settings", {})

    # --- Assign values TO the global variables ---
    DOMAIN_SUFFIX = settings.get("domain_suffix")
    MAIN_PAGE_PATH = settings.get("main_page_path")
    FILE_LIST_PATH = settings.get("file_list_path")
    DOWNLOAD_PATH_TEMPLATE = settings.get("download_path_template")
    DOWNLOAD_TIMEOUT_SECONDS = settings.get("download_timeout", 60) # Default to 60 seconds if not specified

    # Check the globals were assigned correctly
    if not all([DOMAIN_SUFFIX, MAIN_PAGE_PATH, FILE_LIST_PATH, DOWNLOAD_PATH_TEMPLATE]):
        logging.critical("ERROR: Essential URL paths/templates missing in the 'settings' section of the configuration file.")
        return

    users = config.get("users", [])
    if not users or not isinstance(users, list):
        logging.error("❌ 'users' list missing or invalid in configuration JSON.")
        return

    # --- Create WebDriver Instance (Once) ---
    driver = None
    try:
        logging.info("Initializing WebDriver...")
        options = Options()
        options.add_argument("--headless")
        
        driver = webdriver.Chrome(options=options)
        logging.info("WebDriver initialized.")

        session = requests.Session()

        # --- Process Users ---
        for user in users:
            username = user.get("username", "").strip()
            # No password needed for Bina
            if not username:
                logging.warning("⚠️ Skipping user entry with missing username.")
                continue

            logging.info(f"\n===== Processing User: {username} =====")

            # 1. Access User Site (Replaces Login)
            if not access_user_site(driver, username):
                logging.warning(f"Skipping file processing for {username} due to site access failure.")
                continue

            # 2. Transfer Session Cookies (Still potentially useful)
            transfer_cookies(driver, session)

            # 3. Get File List (Replaces Fetch + CSRF)
            file_list_items = fetch_file_list(session, username)
            
            # 4. Download and Extract if files found
            if file_list_items: 
                user_base_url = f"https://{username}{DOMAIN_SUFFIX}"
                gz_files_to_download = [item for item in file_list_items 
                                        if isinstance(item, dict) 
                                        and item.get("FileNm", "").endswith(".gz")
                                        and is_item_from_current_hour(item, datetime.now().hour)]
                
                if gz_files_to_download:
                    # Construct the full download URL
                    file_links = [f"{user_base_url}{DOWNLOAD_PATH_TEMPLATE}{item['FileNm']}" for item in gz_files_to_download]

                    logging.info(f"Found {len(file_links)} '.gz' files to download for {username}.")
                    # Prepare user's XML folder
                    user_xml_folder_path = Path(XML_FOLDER_PATH) / username
                    os.makedirs(user_xml_folder_path, exist_ok=True) # Ensure folder exists here
                    # Call download function
                    download_and_extract(file_links, session, user_xml_folder_path)
                else:
                    logging.info(f"No '.gz' files found in the list for {username}.")

            elif file_list_items is None: # Indicates an error during fetch
                 logging.error(f"Skipping download for {username} due to error fetching file list.")

            # 5. No Logout Needed - Clear cookies for next user's context
            session.cookies.clear()
            logging.info(f"===== Finished Processing User: {username} =====")

    except WebDriverException as e:
        logging.critical(f"WebDriver error occurred: {e}")
    except Exception as e:
        logging.critical(f"An unexpected error occurred in main loop: {type(e).__name__} - {e}", exc_info=True)
    finally:
        # --- Cleanup WebDriver ---
        if driver:
            logging.info("Quitting WebDriver...")
            driver.quit()
            logging.info("WebDriver quit.")

# === LAUNCH ===
if __name__ == "__main__":
    main()