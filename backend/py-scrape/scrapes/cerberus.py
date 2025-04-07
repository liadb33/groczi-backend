import os
import json
import gzip
import shutil
import requests
from datetime import datetime
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

# === CONFIG ===
JSON_FILE_PATH = "../jsons/cerberus.json"
DOWNLOAD_URL = "https://url.publishedprices.co.il/file/d"
POST_URL = "https://url.publishedprices.co.il/file/json/dir"
LOGOUT_URL = "https://url.publishedprices.co.il/logout"
LOGIN_URL ="https://url.publishedprices.co.il/login"

GZ_FOLDER_PATH = os.path.join("../files", "gzFiles")
XML_FOLDER_PATH = os.path.join("../files", "xmlFiles")

# === FILE DOWNLOAD AND EXTRACTION ===
def download_and_extract(file_links, session, user_xml_folder):
    os.makedirs(user_xml_folder, exist_ok=True)

    for file_link in file_links:
        try:
            file_name = file_link.split("/")[-1].split("?")[0]
            gz_path = os.path.join(GZ_FOLDER_PATH, file_name)
            extracted_path = os.path.join(user_xml_folder, file_name.replace(".gz", ".xml"))

            print(f"⬇️ Downloading: {file_name}")
            response = session.get(file_link, headers={
                "Referer": "https://url.publishedprices.co.il/file",
                "User-Agent": "Mozilla/5.0",
                "X-Requested-With": "XMLHttpRequest"
            }, stream=True, timeout=10)
            response.raise_for_status()

            with open(gz_path, "wb") as f:
                shutil.copyfileobj(response.raw, f)

            print(f"📦 Extracting: {file_name}")
            with gzip.open(gz_path, "rb") as gz_file:
                with open(extracted_path, "wb") as xml_file:
                    shutil.copyfileobj(gz_file, xml_file)

            os.remove(gz_path)
            print(f"✅ Done: {file_name}")

        except Exception as e:
            print(f"❌ Failed to process {file_link}: {e}")

# === MAIN ===
def main():
    os.makedirs(GZ_FOLDER_PATH, exist_ok=True)
    os.makedirs(XML_FOLDER_PATH, exist_ok=True)

    # Load configuration JSON
    try:
        with open(JSON_FILE_PATH, "r") as f:
            config = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: Configuration file not found at '{JSON_FILE_PATH}'")
        return
    except json.JSONDecodeError as e:
        print(f"❌ Error: Failed to decode JSON from '{JSON_FILE_PATH}': {e}")
        return
    except Exception as e:
        print(f"❌ Failed to load config: {e}")
        return

    users = config.get("users", [])
    if not users or not isinstance(users, list):
        print("❌ Error: 'users' list missing or invalid in configuration JSON.")
        return

    session = requests.Session()

    for user in users:
        username = user.get("username", "")
        password = user.get("password", "")
        folder = user.get("folder", "")

        if not username:
            print("⚠️ Skipping user with missing username")
            continue

        print(f"\n🔐 Starting session for user: {username}")
        options = Options()
        options.add_argument("--headless")
        driver = webdriver.Chrome(options=options)
        driver.get(LOGIN_URL)

        # Login Process
        try:
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "username"))).send_keys(username)
            if password:
                WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "password"))).send_keys(password)
            driver.find_element(By.NAME, "username").submit()
            WebDriverWait(driver, 10).until(EC.url_contains("/file"))
            print("✅ Logged in")

            selenium_cookies = driver.get_cookies()
            for cookie in selenium_cookies:
                session.cookies.set(cookie['name'], cookie['value'])
        except Exception as e:
            print(f"❌ Login failed for {username}: {e}")
            continue

        user_xml_folder = os.path.join(XML_FOLDER_PATH, username)
        os.makedirs(user_xml_folder, exist_ok=True)

        # Fetch file list and download
        try:
            resp = session.get(LOGIN_URL)
            soup = BeautifulSoup(resp.text, "html.parser")
            meta_tag = soup.find("meta", {"name": "csrftoken"})
            token = meta_tag["content"] if meta_tag else None
            if not token:
                print("❌ CSRF token not found.")
                continue

            found_files = False
            
            # Format timestamp for search
            timestamp = datetime.now().strftime("%d/%m/%Y %H:%M")
            print(f"🔍 Searching with timestamp: {timestamp}")

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
                "sSearch": timestamp,
                "bRegex": "false",
                "iSortingCols": 0,
                "cd": folder if folder else "/",
                "csrftoken": token
            }
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": LOGIN_URL,
                "Origin": "https://url.publishedprices.co.il",
                "X-Requested-With": "XMLHttpRequest",
                "X-CSRFToken": token
            }

            response = session.post(POST_URL, data=payload, headers=headers)
            response.raise_for_status()
            file_data = response.json()

            if file_data.get("aaData"):
                print(f"📄 Found JSON with {len(file_data['aaData'])} entries.")
                found_files = True
            else:
                print("No files found for current timestamp.")

            if found_files:
                file_links = [f"{DOWNLOAD_URL}{folder}/{item['fname']}" if folder else f"{DOWNLOAD_URL}/{item['fname']}" for item in file_data.get("aaData", []) if item.get("fname", "").endswith(".gz")]
                if file_links:
                    download_and_extract(file_links, session, user_xml_folder)
        except Exception as e:
            print(f"🚨 Failed during fetch/download for {username}: {e}")

        # Logging out
        try:
            driver.get(LOGOUT_URL)
            WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.NAME, "username")))
            print(f"🔓 Logged out {username}")
        except Exception as e:
            print(f"⚠️ Failed to logout {username}: {e}")
            driver.quit()
    driver.quit()

# === LAUNCH ===
if __name__ == "__main__":
    main()
