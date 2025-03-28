import os
import time
import json
import gzip
import shutil
import requests
from zipfile import ZipFile
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# === CONFIG ===
json_file_path = "../jsons/bina.json"
base_folder = "D:\\VsCode Projects\\Groczi\\Groczi\\py-scrape\\scrapes\\files"
download_base = os.path.join(base_folder, "gzFiles")
xml_base = os.path.join(base_folder, "xmlFiles")

os.makedirs(download_base, exist_ok=True)
os.makedirs(xml_base, exist_ok=True)

# === FILE EXTRACTION ===
def extract_and_delete(gz_path, extract_to_path):
    try:
        with gzip.open(gz_path, "rb") as gz_file:
            with open(extract_to_path, "wb") as out_file:
                shutil.copyfileobj(gz_file, out_file)
        print(f"✅ Extracted (GZIP): {os.path.basename(gz_path)}")
        os.remove(gz_path)
        return True
    except OSError:
        try:
            with ZipFile(gz_path, 'r') as zip_ref:
                zip_ref.extractall(os.path.dirname(extract_to_path))
            print(f"✅ Extracted (ZIP): {os.path.basename(gz_path)}")
            os.remove(gz_path)
            return True
        except Exception as e:
            print(f"❌ Extraction failed: {e}")
            return False

# === MAIN WORKFLOW ===
def main():
    try:
        with open(json_file_path, "r") as f:
            config = json.load(f)
    except Exception as e:
        print(f"❌ Failed to load config: {e}")
        return

    url_path = config.get("url", ".binaprojects.com/Main.aspx")
    users = config.get("users", [])

    for user_obj in users:
        username = user_obj.get("username")
        if not username:
            continue

        print(f"\n🔐 Starting session for user: {username}")
        user_url = f"https://{username}{url_path}"
        driver = webdriver.Chrome()
        driver.get(user_url)

        try:
            WebDriverWait(driver, 10).until(EC.url_contains("Main"))
            time.sleep(3)
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

        try:
            ts = int(time.time() * 1000)
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
            data = resp.json()
            if isinstance(data, list):
                data = {"aaData": data}

            print(f"📄 Saved JSON with {len(data.get('aaData', []))} entries.")
            user_xml_dir = os.path.join(xml_base, username)
            os.makedirs(user_xml_dir, exist_ok=True)
            with open(os.path.join(user_xml_dir, "file_listing.json"), "w") as f:
                json.dump(data, f, indent=2)

            now = datetime.now()
            time_options = [
                now.strftime("%H:00 %d/%m/%Y"),
                (now - timedelta(hours=1)).strftime("%H:00 %d/%m/%Y")
            ]

            found = False
            summary = {"downloaded": 0, "extracted": 0, "skipped": 0, "failed": 0}

            for match_ts in time_options:
                matching_files = [
                    item for item in data.get("aaData", [])
                    if item.get("DateFile", "").strip() == match_ts and item.get("FileNm", "").endswith(".gz")
                ]
                if matching_files:
                    print(f"📥 Found {len(matching_files)} matching files for {match_ts}. Downloading and extracting...")
                    found = True
                    for item in matching_files:
                        fname = item.get("FileNm")
                        xml_path = os.path.join(xml_base, username, fname.replace(".gz", ".xml"))
                        if os.path.exists(xml_path):
                            print(f"✅ Skipping {fname} - already extracted.")
                            summary["skipped"] += 1
                            continue

                        download_api = f"https://{username}.binaprojects.com/Download.aspx?FileNm={fname}"
                        try:
                            print(f"⬇️ Downloading: {fname}")
                            gz_path = os.path.join(download_base, fname)
                            os.makedirs(os.path.dirname(xml_path), exist_ok=True)

                            dl_resp = session.post(download_api, timeout=10)
                            dl_resp.raise_for_status()
                            json_data = dl_resp.json()
                            s_path = json_data[0].get("SPath")
                            if not s_path:
                                print(f"❌ No download path found for {fname}")
                                summary["failed"] += 1
                                continue

                            file_resp = session.get(s_path, stream=True, timeout=15)
                            file_resp.raise_for_status()
                            with open(gz_path, "wb") as f:
                                shutil.copyfileobj(file_resp.raw, f)
                            summary["downloaded"] += 1

                            print(f"📦 Extracting: {fname}")
                            success = extract_and_delete(gz_path, xml_path)
                            if success:
                                summary["extracted"] += 1
                            else:
                                summary["failed"] += 1

                        except Exception as e:
                            print(f"❌ Failed to process {fname}: {e}")
                            summary["failed"] += 1
                    break

            if not found:
                print("⚠️ No matching files found for current or previous hour.")

            print(f"\n📊 Summary for {username}:")
            for k, v in summary.items():
                print(f"  {k.title()}: {v}")

        except Exception as e:
            print(f"❌ Error fetching/downloading for {username}: {e}")

# === RUN ===
if __name__ == "__main__":
    main()
