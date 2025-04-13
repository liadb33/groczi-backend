import json
import logging
import requests
import gzip
import shutil
import re
import json
import os
from bs4 import BeautifulSoup
from pathlib import Path
from datetime import datetime
from requests.exceptions import RequestException

# === CONFIG ===
SCRIPT_DIR = Path(__file__).parent.resolve()
JSON_FILE_PATH = SCRIPT_DIR.parent / "jsons" / "prices.json"
GZ_FOLDER_PATH = SCRIPT_DIR.parent / "files" / "gzFiles"
XML_FOLDER_PATH = SCRIPT_DIR.parent / "files" / "xmlFilesBitan"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%d/%m/%Y %H:%M'
)

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
        logging.error(f"❌ Failed to load config '{file_path}': {type(e).name} - {e}")
        raise

def fetch_file_list_from_html(session: requests.Session, url: str) -> list[str] | None:
    """🌐 Parses the HTML page and returns a list of full download links for .gz files."""
    try:
        
        logging.info(f"🌐 Fetching HTML page for {url}")

        response = session.get(url, timeout=30)
        response.raise_for_status()
        # Extract the script tag containing the JSON data.
        pattern = r'const\s+files\s*=\s*JSON\.parse\(`(.*?)`\)\.map\(String\);'
        match = re.search(pattern, response.text, re.DOTALL)
        if match:
            files_json_str = match.group(1)
            files_list = json.loads(files_json_str) 
        else:
            print("No match found for the files array.")
            return None
        
        date_str = datetime.now().strftime("%Y%m%d")
        hour_str = datetime.now().strftime("%Y%m%d%H")
        base_url = url.rstrip("/")
          # Filter the file list: only include those filenames that contain the current hour.
        filtered_files = [filename for filename in files_list if hour_str in filename]

        # Chain the base URL, current date, and filtered filename to create full links.
        full_links = [f"{base_url}/{date_str}/{filename}" for filename in filtered_files]
        

    except json.JSONDecodeError as e:
        logging.error(f"❌ Failed to decode JSON from {url}: {e}")
        return None
    except RequestException as e:
        logging.error(f"❌ Request error while fetching HTML {e}")
        return None
    except Exception as e:
        logging.error(f"⚠️ Unexpected error during HTML parsing {type(e).__name__} - {e}")
        return None
    return full_links

def download_and_extract(file_links: list[str], session: requests.Session, user_xml_folder: Path) -> None:
    """📥 Downloads and extracts .gz files to a specified folder."""
    os.makedirs(user_xml_folder, exist_ok=True)
    os.makedirs(GZ_FOLDER_PATH, exist_ok=True)
    for file_link in file_links:
        try:
            file_name_gz = file_link.split("/")[-1]

            gz_path = Path(GZ_FOLDER_PATH) / file_name_gz
            file_name_xml = file_name_gz + ".xml" 
            extracted_path = Path(user_xml_folder) / file_name_xml
            logging.info(f"⬇️ Downloading: {file_link}")
            response = session.get(file_link, stream=True)
            response.raise_for_status() 

            with open(gz_path, "wb") as f:
                shutil.copyfileobj(response.raw, f)

            logging.info(f"📦 Extracting:")
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
            logging.error(f"❌ Unexpected error processing {file_link}: {type(e).name} - {e}")

def main():
    logging.info("🚀 Starting download and extract process...")
    try:
        config = load_config(JSON_FILE_PATH)
    except Exception:
        logging.critical("Failed to load configuration. Exiting.")
        return
   
    session = requests.Session()
    users = config.get("users", [])
    if not users:
        logging.error("❌ No users found in the configuration.")
        return

    for user in users:
        url = user["url"]
        username = user["username"]
        file_links = fetch_file_list_from_html(session, url)
        if file_links:
            user_folder = Path(XML_FOLDER_PATH) / username
            download_and_extract(file_links, session, user_folder)
        else:
            logging.error(f"⚠️ No file links found for {username}")

    logging.info("✅ All done!")


if __name__ == "__main__":
    main()
