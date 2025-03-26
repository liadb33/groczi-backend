import gzip
import os
import shutil
import requests
import json
import time
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime, timedelta
from selenium.webdriver.common.keys import Keys

# === CONFIG ===
json_file_path = "../jsons/cerberus.json"
base_folder = "D:\\VsCode Projects\\Groczi\\Groczi\\py-scrape\\scrapes\\files"

# === FILE FINDING ===
def find_files(driver):
    def enter_folder_if_needed(driver):
        try:
            folder_link = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.XPATH, "//a[contains(@class, 'fd') and contains(@href, '/file/d/')]"))
            )
            folder_name = folder_link.get_attribute("title") or folder_link.text
            print(f"📁 Folder detected: '{folder_name}' - entering...")
            folder_link.click()
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.XPATH, "//table")))
            time.sleep(1)
        except:
            print("📂 No folder found, continuing directly to file search.")

    def perform_search(driver, date_hour):
        print(f"🔍 Searching with timestamp: {date_hour}")
        search_bar = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//input[@type='search']"))
        )
        search_bar.clear()
        search_bar.send_keys(date_hour)
        search_bar.send_keys(Keys.RETURN)
        time.sleep(2)

        # Scroll to bottom until all files are loaded
        last_height = driver.execute_script("return document.body.scrollHeight")
        while True:
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                break
            last_height = new_height

        file_elements = driver.find_elements(By.XPATH, "//a[contains(@href, '.gz')]")
        return [elem.get_attribute("href") for elem in file_elements]

    enter_folder_if_needed(driver)

    now = datetime.now()
    timestamp = now.strftime("%Y%m%d%H")
    file_links = perform_search(driver, timestamp)

    if file_links:
        print(f"✅ Found {len(file_links)} .gz files for {timestamp}")
        return file_links

    # Try previous hour
    prev = now - timedelta(hours=1)
    prev_timestamp = prev.strftime("%Y%m%d%H")
    print(f"🕐 Trying previous hour: {prev_timestamp}")
    file_links = perform_search(driver, prev_timestamp)

    if file_links:
        print(f"✅ Found {len(file_links)} .gz files for {prev_timestamp}")
    else:
        print("⚠️ No .gz files found for current or previous hour.")

    return file_links

# === DOWNLOAD AND EXTRACT ===
def download_files(file_links, session_cookies, download_folder, xml_folder, username):
    user_xml_folder = os.path.join(xml_folder, username)
    os.makedirs(user_xml_folder, exist_ok=True)

    log_path = os.path.join(user_xml_folder, "downloads_log.json")
    if os.path.exists(log_path):
        with open(log_path, "r") as f:
            log_data = json.load(f)
    else:
        log_data = []

    for file_link in file_links:
        try:
            file_name = file_link.split("/")[-1]
            gz_file_path = os.path.join(download_folder, file_name)
            extracted_file_path = os.path.join(user_xml_folder, file_name.replace(".gz", ".xml"))

            # Skip if already exists
            if os.path.exists(extracted_file_path):
                print(f"✅ Skipping {file_name} - already extracted.")
                continue

            # Retry logic
            MAX_RETRIES = 3
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    print(f"🔄 Download attempt {attempt} for {file_name}")
                    response = requests.get(file_link, cookies=session_cookies, stream=True, timeout=10)
                    response.raise_for_status()
                    with open(gz_file_path, "wb") as file:
                        shutil.copyfileobj(response.raw, file)
                    print(f"✅ Downloaded: {file_name}")
                    break
                except Exception as e:
                    print(f"❌ Attempt {attempt} failed for {file_name}: {e}")
                    if attempt == MAX_RETRIES:
                        print(f"🚫 Giving up on {file_name}")
                        continue

            # Extract the file
            print(f"📦 Extracting: {file_name}")
            with gzip.open(gz_file_path, "rb") as gz_file:
                with open(extracted_file_path, "wb") as xml_file:
                    shutil.copyfileobj(gz_file, xml_file)
            print(f"✅ Extracted: {file_name} -> {extracted_file_path}")

            os.remove(gz_file_path)
            print(f"🗑️ Deleted: {gz_file_path}")

            log_data.append({
                "file": file_name,
                "downloaded_at": datetime.now().isoformat()
            })
            with open(log_path, "w") as f:
                json.dump(log_data, f, indent=2)

        except Exception as e:
            print(f"🚨 Failed to process {file_link}. Error: {e}")

# === MAIN DRIVER ===
def main():
    try:
        with open(json_file_path, "r") as json_file:
            cerberusJson = json.load(json_file)
    except FileNotFoundError:
        print("❌ Error: cerberus.py : File not found")
        return
    except json.decoder.JSONDecodeError:
        print("❌ Error: cerberus.py : Invalid JSON")
        return

    login_url = cerberusJson.get("url", "")
    users_list = cerberusJson.get("users", [])

    if not login_url or not users_list or not isinstance(users_list, list):
        print("❌ Error: Invalid or missing login URL / users")
        return

    download_folder = os.path.join(base_folder, "gzFiles")
    xml_folder = os.path.join(base_folder, "xmlFiles")
    os.makedirs(download_folder, exist_ok=True)
    os.makedirs(xml_folder, exist_ok=True)

    for user in users_list:
        username = user.get("username", "")
        password = user.get("password", "")
        if not username:
            print("⚠️ Skipping user with missing username")
            continue

        print(f"\n🔐 Starting session for user: {username}")
        driver = webdriver.Chrome()
        driver.get(login_url)
        time.sleep(1)

        try:
            username_field = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.NAME, "username"))
            )
            username_field.send_keys(username)

            if password:
                password_field = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.NAME, "password"))
                )
                password_field.send_keys(password)

            username_field.submit()

            WebDriverWait(driver, 10).until(EC.url_contains("/file"))
            print("✅ Logged in, navigating to files...")

            time.sleep(6)
            file_links = find_files(driver)

            cookies = driver.get_cookies()
            session_cookies = {cookie['name']: cookie['value'] for cookie in cookies}

            download_files(file_links, session_cookies, download_folder, xml_folder, username)

        except Exception as e:
            print(f"❌ Login or fetch failed for user {username}: {e}")
        finally:
            driver.quit()

# === LAUNCH ===
if __name__ == "__main__":
    main()
