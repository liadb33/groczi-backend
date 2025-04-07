import os
import json
import gzip
import shutil
import requests
from datetime import datetime, timedelta
from zipfile import ZipFile
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

# === CONFIG ===
JSON_FILE_PATH = "../jsons/bina.json"
GZ_FOLDER_PATH = os.path.join("../files", "gzFiles")
XML_FOLDER_PATH = os.path.join("../files", "xmlFiles")

def extract_and_delete(gz_path, extract_to_path):
    try:
        # ניסיון לפתוח כקובץ GZIP
        with gzip.open(gz_path, "rb") as gz_file:
            with open(extract_to_path, "wb") as out_file:
                shutil.copyfileobj(gz_file, out_file)
        print(f"✅ Extracted (GZIP): {os.path.basename(gz_path)}")
        os.remove(gz_path)
        return True
    except OSError as e:
        # אם השגיאה היא לא OSError, ננסה פורמט ZIP
        try:
            with ZipFile(gz_path, 'r') as zip_ref:
                zip_ref.extractall(os.path.dirname(extract_to_path))
            print(f"✅ Extracted (ZIP): {os.path.basename(gz_path)}")
            os.remove(gz_path)
            return True
        except Exception as e:
            print(f"❌ Extraction failed: {e}")
            return False


# === MAIN ===
def main():
    os.makedirs(GZ_FOLDER_PATH, exist_ok=True)
    os.makedirs(XML_FOLDER_PATH, exist_ok=True)

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

    login_url = config.get("url", "")
    users = config.get("users", [])
    
    if not login_url:
        print("❌ Error: 'url' missing or empty in configuration JSON.")
        return
    if not users or not isinstance(users, list):
        print("❌ Error: 'users' list missing or invalid in configuration JSON.")
        return

    for user in users:
        username = user.get("username", "")
        if not username:
            print("⚠️ Skipping user with missing username")
            continue

        print(f"\n🔐 Starting session for user: {username}")
        user_url = f"https://{username}{login_url}"
        options = Options()
        options.add_argument("--headless")
        driver = webdriver.Chrome(options=options)
        driver.get(user_url)

        try:
            WebDriverWait(driver, 10).until(EC.url_contains("Main"))
            selenium_cookies = driver.get_cookies()
            session = requests.Session()
            for cookie in selenium_cookies:
                session.cookies.set(cookie['name'], cookie['value'])
            print("✅ Logged in")
        except Exception as e:
            print(f"❌ Login failed for {username}: {e}")
            driver.quit()
            continue
        finally:
            driver.quit()

        try:
            ts = int(datetime.timestamp(datetime.now()) * 1000)
            date_str = datetime.now().strftime("%d/%m/%Y")
            file_url = f"https://{username}.binaprojects.com/MainIO_Hok.aspx"
            params = {
                "_": ts,
                "WStore": "",
                "WDate": date_str,
                "WFileType": "0"
            }
            headers = {
                "User-Agent": "Mozilla/5.0",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": user_url
            }
            
            resp = session.get(file_url, params=params, headers=headers)
            resp.raise_for_status()
            file_data = resp.json()
            if isinstance(file_data, list):
                file_data = {"aaData": file_data}
            
            print(f"📄 Found JSON with {len(file_data.get('aaData', []))} entries.")
            user_xml_folder = os.path.join(XML_FOLDER_PATH, username)
            os.makedirs(user_xml_folder, exist_ok=True)
            
            file_links = [
                f"https://{username}.binaprojects.com/Download.aspx?FileNm={item['FileNm']}"
                for item in file_data.get("aaData", []) if item.get("FileNm", "").endswith(".gz")
            ]
            
            if file_links:
                for file_link in file_links:
                    try:
                        file_name = file_link.split("=")[-1]
                        gz_path = os.path.join(GZ_FOLDER_PATH, file_name)
                        extracted_path = os.path.join(user_xml_folder, file_name.replace(".gz", ".xml"))
                        
                        print(f"⬇️ Downloading: {file_name}")
                        response = session.get(file_link, stream=True, timeout=10)
                        response.raise_for_status()
                        
                        with open(gz_path, "wb") as f:
                            shutil.copyfileobj(response.raw, f)
                        
                        print(f"📦 Extracting: {file_name}")
                        success = extract_and_delete(gz_path, extracted_path)
                        if success:
                            print(f"✅ Done: {file_name}")
                        else:
                            print(f"❌ Failed to extract {file_name}")
                    except Exception as e:
                        print(f"❌ Failed to process {file_link}: {e}")
            else:
                print("⚠️ No .gz files found.")
        except Exception as e:
            print(f"❌ Error fetching/downloading for {username}: {e}")

# === LAUNCH ===
if __name__ == "__main__":
    main()
