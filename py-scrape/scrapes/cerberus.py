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

# === CONFIG ===
json_file_path = "../jsons/cerberus.json"
base_download_url = "https://url.publishedprices.co.il/file/d"
post_url = "https://url.publishedprices.co.il/file/json/dir"
download_folder = os.path.join("./files", "gzFiles")
xml_folder = os.path.join("./files", "xmlFiles")

# === FILE DOWNLOAD AND EXTRACTION ===
def download_and_extract(file_links, session, user_xml_folder):
    os.makedirs(user_xml_folder, exist_ok=True)

    for file_link in file_links:
        try:
            file_name = file_link.split("/")[-1].split("?")[0]
            gz_path = os.path.join(download_folder, file_name)
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

# === MAIN DRIVER ===
def main():
    os.makedirs(download_folder, exist_ok=True)
    os.makedirs(xml_folder, exist_ok=True)

    try:
        with open(json_file_path, "r") as json_file:
            cerberusJson = json.load(json_file)
    except Exception as e:
        print(f"❌ Failed to load config: {e}")
        return

    login_url = cerberusJson.get("url", "")
    users_list = cerberusJson.get("users", [])

    if not login_url or not users_list or not isinstance(users_list, list):
        print("❌ Error: Invalid or missing login URL / users")
        return

    for user in users_list:
        username = user.get("username", "")
        password = user.get("password", "")
        folder = user.get("folder", "")

        if not username:
            print("⚠️ Skipping user with missing username")
            continue

        print(f"\n🔐 Starting session for user: {username}")
        driver = webdriver.Chrome()
        driver.get(login_url)

        try:
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "username"))).send_keys(username)
            if password:
                WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "password"))).send_keys(password)
            driver.find_element(By.NAME, "username").submit()
            WebDriverWait(driver, 10).until(EC.url_contains("/file"))
            print("✅ Logged in")

            selenium_cookies = driver.get_cookies()
            session = requests.Session()
            for cookie in selenium_cookies:
                session.cookies.set(cookie['name'], cookie['value'])

        except Exception as e:
            print(f"❌ Login failed for {username}: {e}")
            driver.quit()
            continue

        finally:
            driver.quit()

        user_xml_folder = os.path.join(xml_folder, username)
        os.makedirs(user_xml_folder, exist_ok=True)

        try:
            resp = session.get(login_url)
            soup = BeautifulSoup(resp.text, "html.parser")
            meta_tag = soup.find("meta", {"name": "csrftoken"})
            token = meta_tag["content"] if meta_tag else None
            if not token:
                print("❌ CSRF token not found.")
                continue

            found_files = False
        
            timestamp = datetime.now().strftime("%Y%m%d%H")
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
                "Referer": login_url,
                "Origin": "https://url.publishedprices.co.il",
                "X-Requested-With": "XMLHttpRequest",
                "X-CSRFToken": token
            }

            response = session.post(post_url, data=payload, headers=headers)
            response.raise_for_status()
            file_data = response.json()

            if file_data.get("aaData"):
                print(f"📄 Found JSON with {len(file_data['aaData'])} entries.")
                found_files = True
            else:
                print("No files found for current timestamp.")

            if not found_files:
                print(f"🛑 Skipping user {username}: No files found for current or previous hour.")
                continue

            file_links = []
            for item in file_data.get("aaData", []):
                fname = item.get("fname", "")
                if fname.endswith(".gz"):
                    if folder: ## Check if there is a folder path (Yuda) 
                        url = f"{base_download_url}{folder}/{fname}"
                    else:
                        url = f"{base_download_url}/{fname}"
                    file_links.append(url)

            if file_links:
                download_and_extract(file_links, session, user_xml_folder)
            else:
                print("❌ No .gz links in saved JSON.")

        except Exception as e:
            print(f"🚨 Failed during fetch/download for {username}: {e}")

# === LAUNCH ===
if __name__ == "__main__":
    main()
