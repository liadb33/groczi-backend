import json
import logging
import requests
import gzip
import shutil
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

def read_config(config_path: str) -> list[dict]:
    """📖 Reads usernames and settings from JSON config file."""
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    return config["users"]

def fetch_file_list_from_html(session: requests.Session, username: str) -> list[str] | None:
    """🌐 Parses the HTML page and returns a list of full download links for .gz files."""
    try:
        url = f"https://prices.{username}.co.il/"
        logging.info(f"🌐 Fetching HTML page for {username} from {url}")

        response = session.get(url, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        file_links = []

        for link in soup.find_all('a', href=True):
            href = link['href'].lstrip("./")
            if href.endswith(".gz"):
                full_link = url + href
                file_links.append(full_link)

        logging.info(f"🔗 Found {len(file_links)} .gz file links for {username}")
        return file_links

    except RequestException as e:
        logging.error(f"❌ Request error while fetching HTML for {username}: {e}")
        return None
    except Exception as e:
        logging.error(f"⚠️ Unexpected error during HTML parsing for {username}: {type(e).__name__} - {e}")
        return None

def download_and_extract(file_urls: list[str], session: requests.Session, target_dir: Path) -> None:
    """📥 Downloads and extracts .gz files to a specified folder."""
    target_dir.mkdir(parents=True, exist_ok=True)
    for url in file_urls:
        filename = url.split("/")[-1]
        gz_path = target_dir / filename
        xml_path = target_dir / filename.replace(".gz", "")

        try:
            logging.info(f"⬇️ Downloading {url}")
            with session.get(url, timeout=60, stream=True) as r:
                r.raise_for_status()
                with open(gz_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)

            with gzip.open(gz_path, "rb") as f_in:
                with open(xml_path, "wb") as f_out:
                    shutil.copyfileobj(f_in, f_out)

            logging.info(f"📦 Extracted to {xml_path}")
            gz_path.unlink()

        except Exception as e:
            logging.error(f"❌ Failed to download or extract {url}: {e}")

def main():
    logging.info("🚀 Starting download and extract process...")
    users = read_config(JSON_FILE_PATH)
    session = requests.Session()

    for user in users:
        username = user["username"]
        file_links = fetch_file_list_from_html(session, username)
        if file_links:
            user_folder = Path(XML_FOLDER_PATH) / username
            download_and_extract(file_links, session, user_folder)
        else:
            logging.error(f"⚠️ No file links found for {username}")

    logging.info("✅ All done!")

if __name__ == "__main__":
    main()
