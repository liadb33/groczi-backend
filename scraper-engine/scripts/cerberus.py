import os
import json
import gzip
import shutil
import requests
from datetime import datetime, timedelta
from pathlib import Path 
import logging 

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from requests.exceptions import RequestException 
from selenium.common.exceptions import WebDriverException 

# === CONFIG ===
SCRIPT_DIR = Path(__file__).parent.resolve()
# paths relative to the script's directory
JSON_FILE_PATH = SCRIPT_DIR.parent / "configs" / "cerberus.json"
GZ_FOLDER_PATH = SCRIPT_DIR.parent / "output" / "gz"
XML_FOLDER_GROCERY_PATH = SCRIPT_DIR.parent / "output" / "groceries"
XML_FOLDER_STORE_PATH = SCRIPT_DIR.parent / "output" / "stores"
XML_FOLDER_PROMOTION_PATH = SCRIPT_DIR.parent / "output" / "promotions"
XML_OTHERS_FOLDER_PATH = SCRIPT_DIR.parent / "output" / "others"

LOGIN_URL = None
LOGOUT_URL = None
POST_URL = None
DOWNLOAD_URL = None

# === CONSTANTS ===
POST_REQUEST_HEADERS_BASE = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": LOGIN_URL,
    "Origin": "https://url.publishedprices.co.il",
    "X-Requested-With": "XMLHttpRequest",
    # X-CSRFToken added dynamically
}
DOWNLOAD_TIMEOUT_SECONDS = 60 

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%d/%m/%Y %H:%M'  
)

# === FILE DOWNLOAD AND EXTRACTION ===
def download_and_extract(file_links: list[str], session: requests.Session, username: str):
    """Downloads GZ files, extracts them to XML in the user's folder, and removes the GZ."""
    
    for file_link in file_links:
        try:
            file_name_gz = file_link.split("/")[-1].split("?")[0]
            if not file_name_gz.endswith(".gz"):
                 logging.warning(f"Skipping link - expected .gz file: {file_link}")
                 continue

            gz_path = Path(GZ_FOLDER_PATH) / file_name_gz
            file_name_xml = file_name_gz[:-3] + ".xml" 
            user_xml_folder = (
                XML_FOLDER_GROCERY_PATH if "price" in file_name_gz.lower() else
                XML_FOLDER_STORE_PATH if "store" in file_name_gz.lower() else
                XML_FOLDER_PROMOTION_PATH if "promo" in file_name_gz.lower() else
                XML_OTHERS_FOLDER_PATH
            )
        
            extracted_path = user_xml_folder / username / file_name_xml
            extracted_path.parent.mkdir(parents=True, exist_ok=True)
            
            logging.info(f"⬇️ Downloading: {file_name_gz} to {gz_path}")
            response = session.get(file_link, stream=True, timeout=DOWNLOAD_TIMEOUT_SECONDS)
            response.raise_for_status() 

            with open(gz_path, "wb") as f_gz:
                shutil.copyfileobj(response.raw, f_gz)

            logging.info(f"📦 Extracting: {gz_path} to {extracted_path}")
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

# === HELPER FUNCTIONS (Refactored from main) ===
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

def perform_login(driver: webdriver.Chrome, username: str, password: str | None) -> bool:
    """Logs in using Selenium."""
    logging.info(f"Attempting login for {username}...")
    driver.get(LOGIN_URL)
    try:
        user_field = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "username")))
        user_field.send_keys(username)
        if password:
            pass_field = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "password")))
            pass_field.send_keys(password)
       
        user_field.submit()
        WebDriverWait(driver, 15).until(EC.url_contains("/file"))
        logging.info(f"✅ Login successful for {username}")
        return True
    except WebDriverException as e:
        logging.error(f"❌ Login failed for {username}: {e}")
        return False

def transfer_cookies(driver: webdriver.Chrome, session: requests.Session):
    """Transfers cookies from Selenium WebDriver to requests Session."""
    logging.debug("Transferring cookies from WebDriver to requests session...")
    selenium_cookies = driver.get_cookies()
    for cookie in selenium_cookies:
        session.cookies.set(cookie['name'], cookie['value'], domain=cookie.get('domain'), path=cookie.get('path'))
    logging.debug(f"Transferred {len(selenium_cookies)} cookies.")

def get_csrf_token_from_page(driver: webdriver.Chrome) -> str | None:
     """Attempts to extract CSRF token directly from the Selenium driver's page source."""
     logging.debug("Attempting to extract CSRF token from page source...")
     try:
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, "html.parser")
        meta_tag = soup.find("meta", {"name": "csrftoken"})
        token = meta_tag["content"]
        return token
     except Exception as e:
        logging.error(f"Error extracting CSRF token from page source: {e}")
        return None

def fetch_file_list(session: requests.Session, token: str, search_criteria: str, folder: str) -> list | None:
    """Fetches the list of files matching the criteria via POST request."""
    logging.info(f"Fetching file list with search: '{search_criteria}', folder: '{folder or '/'}'")
    payload = {
        "sEcho": 1, 
        "iColumns": 5,
        "sColumns": ",,,,",
        "iDisplayStart": 0,
        "iDisplayLength": 100000,
        "mDataProp_0": "fname", "mDataProp_1": "typeLabel", "mDataProp_2": "size",
        "mDataProp_3": "ftime", "mDataProp_4": "",
        "sSearch": search_criteria,
        "bRegex": "false",
        "iSortingCols": 0,
        "cd": folder if folder else "/",
        "csrftoken": token 
    }
    headers = POST_REQUEST_HEADERS_BASE.copy()
    headers["X-CSRFToken"] = token

    try:
        response = session.post(POST_URL, data=payload, headers=headers)
        response.raise_for_status()
        file_data = response.json()
        logging.debug(f"Raw file list response: {file_data}") # Debug level for potentially large output
        
        if isinstance(file_data, dict) and 'aaData' in file_data:
            if file_data.get("aaData"):
                 logging.info(f"Found {len(file_data['aaData'])} file entries.")
                 return file_data["aaData"]
            else:
                 logging.info("No files found matching criteria.")
                 return [] 
        else:
            logging.error(f"Unexpected JSON structure received from file list endpoint: {file_data}")
            return None # Indicate an error

    except RequestException as e:
        logging.error(f"Failed POST request to fetch file list: {e}")
        return None # Indicate an error
    except json.JSONDecodeError as e:
        logging.error(f"Failed to decode JSON response from file list endpoint: {e} - Response text: {response.text[:500]}") # Log part of the text
        return None

def perform_logout(driver: webdriver.Chrome):
    """Logs out using Selenium."""
    logging.info("Attempting logout...")
    try:
        driver.get(LOGOUT_URL)
        # Wait for an element that reliably appears on the login page after logout
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "username")))
        logging.info("✅ Logout successful.")
        return True
    except WebDriverException as e:
        logging.warning(f"⚠️ Logout navigation/check failed: {e}")
        return False

 
# === MAIN ORCHESTRATION ===
def main():
    """Main script execution flow."""
    # --- Setup ---
    global LOGIN_URL, LOGOUT_URL, POST_URL, DOWNLOAD_URL
    try:
        config = load_config(JSON_FILE_PATH)
    except Exception:
        logging.critical("Failed to load configuration. Exiting.")
        return 
    
    settings = config.get("settings", {})
    
    # Get the URLs from the loaded settings
    LOGIN_URL = settings.get("login_url")
    LOGOUT_URL = settings.get("logout_url")
    POST_URL = settings.get("post_url")
    DOWNLOAD_URL = settings.get("download_base_url") 
    
    os.makedirs(GZ_FOLDER_PATH, exist_ok=True)
    
    if not all([LOGIN_URL, LOGOUT_URL, POST_URL, DOWNLOAD_URL]):
        logging.critical("ERROR: Essential URLs not found in the 'settings' section of the configuration file.")
        return 

    users = config.get("users", [])
    if not users or not isinstance(users, list):
        logging.error("❌ 'users' list missing or invalid in configuration JSON.")
        return

    # --- Create WebDriver Instance (Once) ---
    driver = None # Initialize driver variable
    try:
        logging.info("Initializing WebDriver...")
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--disable-gpu")

        driver = webdriver.Chrome(options=options)
        logging.info("WebDriver initialized.")

        # --- Create Requests Session (Once) ---
        session = requests.Session()

        # --- Process Users ---
        for user in users:
            username = user.get("username", "").strip()
            password = user.get("password", "") # Allow empty password if needed
            folder = user.get("folder", "").strip() 

            if not username:
                logging.warning("⚠️ Skipping user entry with missing username.")
                continue

            logging.info(f"\n===== Processing User: {username} =====")

            # 1. Login
            if not perform_login(driver, username, password):
                logging.warning(f"Skipping file processing for {username} due to login failure.")
                continue # Move to the next user

            # 2. Transfer Session Cookies
            transfer_cookies(driver, session)

            # 3. Get CSRF Token 
            token = get_csrf_token_from_page(driver)
            if not token:
                 logging.error(f"❌ Could not obtain CSRF token for {username}. Skipping file fetch.")
                 perform_logout(driver)
                 continue

            # 5. Fetch File List
            search_criteria = (datetime.now() - timedelta(hours=1)).strftime("%Y%m%d%H")
 
            file_list = fetch_file_list(session, token, search_criteria, folder)

            # 6. Download and Extract if files found
            if file_list:
                base_download_url = f"{DOWNLOAD_URL}{folder}/" if folder else f"{DOWNLOAD_URL}/"
                
                # Filter for .gz files and get 'fname' safely
                gz_files_to_download = [item for item in file_list if isinstance(item, dict) and item.get("fname", "").endswith(".gz")]
                
                if gz_files_to_download:
                    file_links = [f"{base_download_url}{item['fname']}" for item in gz_files_to_download]
                    logging.info(f"Found {len(file_links)} '.gz' files to download for {username}.")
                    download_and_extract(file_links, session, username)
                else:
                    logging.info(f"No '.gz' files found in the list for {username}.")
            elif file_list is None: # Indicates an error during fetch
                 logging.error(f"Skipping download for {username} due to error fetching file list.")

            # 7. Logout (within the loop for this user)
            perform_logout(driver)
            # Clear cookies for the next user? Maybe not strictly necessary if login overwrites, but can be safer.
            session.cookies.clear()
            logging.info(f"===== Finished Processing User: {username} =====")
    except WebDriverException as e:
        logging.critical(f"WebDriver error occurred: {e}")
    except Exception as e:
        # Catch-all for unexpected errors during main orchestration
        logging.critical(f"An unexpected error occurred in main loop: {type(e).__name__} - {e}", exc_info=True) # Log traceback
    finally:
        # --- Cleanup WebDriver ---
        if driver:
            logging.info("Quitting WebDriver...")
            driver.quit()
            logging.info("WebDriver quit.")
        


# === LAUNCH ===
if __name__ == "__main__":
    main()