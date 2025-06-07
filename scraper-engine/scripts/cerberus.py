import os
import json
import requests
import sys
import time

from datetime import datetime, timedelta
from pathlib import Path
from requests.exceptions import RequestException
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import WebDriverException

# Utils imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.logging import log_info, log_success, log_warn, log_error, log_critical
from utils.selenium import perform_logout, perform_login, transfer_cookies, get_csrf_token_from_page
from utils.json import load_config
from utils.constants import *
from utils.filesys import determine_folder, extract_file  

# Record script start time and hour for filtering
SCRIPT_START = datetime.now()
SCRIPT_START_HOUR = SCRIPT_START.hour

# Config path
JSON_FILE_PATH = get_json_file_path("cerberus.json")

# URLs to be populated from config
LOGIN_URL = None
LOGOUT_URL = None
POST_URL = None
DOWNLOAD_URL = None

# Base headers for POST
POST_REQUEST_HEADERS_BASE = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": LOGIN_URL,
    "Origin": "https://url.publishedprices.co.il",
    "X-Requested-With": "XMLHttpRequest",
}

# --- Fetch file list via POST ---
def fetch_file_list(session: requests.Session, token: str, search_criteria: str, folder: str) -> list | None:
    payload = {
        "sEcho": 1,
        "iColumns": 5,
        "sColumns": ",,,,",
        "iDisplayStart": 0,
        "iDisplayLength": 100000,
        "mDataProp_0": "fname",
        "mDataProp_1": "typeLabel",
        "mDataProp_2": "size",
        "mDataProp_3": "ftime",
        "mDataProp_4": "",
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
        data = response.json()
        if isinstance(data, dict) and "aaData" in data:
            return data.get("aaData", [])
        else:
            log_warn(f"Unexpected JSON structure: {data}")
            return None
    except RequestException as e:
        log_error(f"Failed POST request: {e}")
        return None
    except json.JSONDecodeError as e:
        text_snippet = response.text[:500] if 'response' in locals() else ''
        log_error(f"JSON decode error: {e} - {text_snippet}")
        return None

# --- Download and extract ---
def download_and_extract(file_links: list[str], session: requests.Session, username: str):
    failures = []
    for link in file_links:
        try:
            file_name_gz = link.split('/')[-1].split('?')[0]
            if not file_name_gz.endswith('.gz'):
                log_warn(f"Skipping non-.gz link: {link}")
                continue

            gz_path = Path(GZ_FOLDER_PATH) / file_name_gz
            xml_name = file_name_gz[:-3] + '.xml'
            user_dir = determine_folder(file_name_gz, username)
            target_path = user_dir / username / xml_name
            target_path.parent.mkdir(parents=True, exist_ok=True)

            with session.get(link, stream=True, timeout=60) as resp:
                resp.raise_for_status()
                with open(gz_path, 'wb') as f:
                    for chunk in resp.iter_content(8192):
                        if chunk:
                            f.write(chunk)

            extract_file(gz_path, target_path)  # <-- use shared util
            os.remove(gz_path)

            log_success(f"✅ {file_name_gz} downloaded & extracted")
        except Exception as e:
            log_error(f"Error for {link}: {type(e).__name__} - {e}")
            failures.append(link)

    if failures:
        log_warn("⚠️ Some files failed:")
        for f in failures:
            log_error(f" - {f}")
    else:
        log_success(f"🎉 All files processed for user {username}!")

# --- Main orchestration ---
def main():
    global LOGIN_URL, LOGOUT_URL, POST_URL, DOWNLOAD_URL
    try:
        config = load_config(JSON_FILE_PATH)
    except Exception:
        log_critical("Failed to load configuration. Exiting.")
        return

    settings = config.get('settings', {})
    LOGIN_URL   = settings.get('login_url')
    LOGOUT_URL  = settings.get('logout_url')
    POST_URL    = settings.get('post_url')
    DOWNLOAD_URL= settings.get('download_base_url')

    if not all([LOGIN_URL, LOGOUT_URL, POST_URL, DOWNLOAD_URL]):
        log_critical("Essential URLs missing in configuration.")
        return

    users = config.get('users', [])
    if not isinstance(users, list) or not users:
        log_error("No users defined in configuration.")
        return

    try:
        options = Options()
        options.add_argument('--headless')
        driver = webdriver.Chrome(options=options)
        session = requests.Session()

        # build search criteria based on script start
        criteria = (SCRIPT_START - timedelta(hours=1)).strftime('%Y%m%d%H')

        for user in users:
            username = user.get('username','').strip()
            password = user.get('password','')
            folder   = user.get('folder','').strip()

            if not username:
                log_warn("Skipping user with missing username.")
                continue
            log_info(f"===== Processing User: {username} =====")

            if not perform_login(driver, username, password, LOGIN_URL):
                log_warn(f"Login failed for {username}, skipping.")
                continue
            transfer_cookies(driver, session)

            token = get_csrf_token_from_page(driver)
            if not token:
                log_error(f"No CSRF token for {username}, skipping.")
                perform_logout(driver, LOGOUT_URL)
                continue

            entries = fetch_file_list(session, token, criteria, folder)
            if entries is None:
                log_error(f"Skipping download for {username} due to fetch error.")
            else:
                gz_entries = [e for e in entries 
                              if isinstance(e, dict) and e.get('fname','').endswith('.gz')]
                if gz_entries:
                    links = [f"{DOWNLOAD_URL}{folder}/{e['fname']}" for e in gz_entries]
                    download_and_extract(links, session, username)
                else:
                    log_info(f"No .gz files for {username}.")

            perform_logout(driver, LOGOUT_URL)
            session.cookies.clear()
            log_info(f"===== Finished User: {username} =====")

    except WebDriverException as e:
        log_critical(f"WebDriver error: {e}")
    except Exception as e:
        log_critical(f"Unexpected error: {type(e).__name__} - {e}")
    finally:
        if driver:
            log_info("Quitting WebDriver...")
            driver.quit()
            log_info("WebDriver quit.")

if __name__ == '__main__':
    main()
