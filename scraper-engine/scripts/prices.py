import os
import json
import requests
import gzip
import shutil
import re
import sys
from pathlib import Path
from tqdm import tqdm
from datetime import datetime, timedelta
from requests.exceptions import RequestException

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.json import load_config
from utils.filesys import determine_folder
from utils.filesys import parse_args
from utils.constants import *

import logging
from tqdm import tqdm
import time
import colorama
from colorama import Fore, Style
colorama.init(autoreset=True)

JSON_FILE_PATH = get_json_file_path("prices.json")

def fetch_file_list_from_html(session: requests.Session, url: str, hour_str: str | None = None) -> list[str] | None:
    """🌐 Parses the HTML page and returns a list of full download links for .gz files.

    Args:
        session (requests.Session): The HTTP session to use.
        url (str): The base URL to fetch files from.
        hour_str (str | None): Specific hour to filter files by (format: YYYYMMDDHH). If None, uses current hour - 1.

    Returns:
        list[str] | None: A list of filtered download links or None on failure.
    """
    try:
        response = session.get(url, timeout=30)
        response.raise_for_status()

        pattern = r'const\s+files\s*=\s*JSON\.parse\(`(.*?)`\)\.map\(String\);'
        match = re.search(pattern, response.text, re.DOTALL)
        if match:
            files_json_str = match.group(1)
            files_list = json.loads(files_json_str)
        else:
            print("No match found for the files array.")
            return None

        now = datetime.now()
        date_str = now.strftime("%Y%m%d")
        if hour_str is None:
            hour_str = (now - timedelta(hours=1)).strftime("%Y%m%d%H")

        base_url = url.rstrip("/")
        filtered_files = [filename for filename in files_list if hour_str in filename]
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

def download_and_extract(file_links: list[str], session: requests.Session, userFolder: str) -> None:
    os.makedirs(GZ_FOLDER_PATH, exist_ok=True)
    failed_files = []

    print(f"        {Fore.CYAN}🗃 Starting downloads for user: {userFolder}{Style.RESET_ALL}")

    for file_link in file_links:
        file_name_gz = file_link.split("/")[-1]
        start_time = time.time()
        try:
            user_xml_folder = determine_folder(file_name_gz, userFolder)
            os.makedirs(user_xml_folder, exist_ok=True)

            gz_path = Path(GZ_FOLDER_PATH) / file_name_gz
            file_name_xml = file_name_gz + ".xml"
            extracted_path = Path(user_xml_folder) / file_name_xml

            response = session.get(file_link, stream=True, timeout=30)
            response.raise_for_status()

            total_size = int(response.headers.get("content-length", 0))
            block_size = 8192

            # tqdm עם סך גודל להראות בר בזמן אמת
            with open(gz_path, "wb") as f, tqdm(
                total=total_size, unit='B', unit_scale=True, desc=file_name_gz, leave=False
            ) as pbar:
                for data in response.iter_content(block_size):
                    f.write(data)
                    pbar.update(len(data))

            with gzip.open(gz_path, "rb") as f_gzip:
                with open(extracted_path, "wb") as f_xml:
                    shutil.copyfileobj(f_gzip, f_xml)

            os.remove(gz_path)

            elapsed = time.time() - start_time
            print(f"{Fore.GREEN}✅ {file_name_gz} downloaded & extracted in {elapsed:.2f}s{Style.RESET_ALL}")

        except requests.RequestException as e:
            logging.error(f"{Fore.RED}❌ Download failed for {file_link}: {e}{Style.RESET_ALL}")
            failed_files.append(file_link)
        except OSError as e:
            logging.error(f"{Fore.RED}❌ File/Extract error for {file_name_gz}: {e}{Style.RESET_ALL}")
            failed_files.append(file_link)
        except Exception as e:
            logging.error(f"{Fore.RED}❌ Unexpected error for {file_link}: {type(e).__name__} - {e}{Style.RESET_ALL}")
            failed_files.append(file_link)

    if failed_files:
        print(f"{Fore.YELLOW}⚠️ Some files failed to download:{Style.RESET_ALL}")
        for file in failed_files:
            print(f"{Fore.YELLOW}  - {file}{Style.RESET_ALL}")
    else:
        print(f"{Fore.GREEN}🎉 All files downloaded successfully for user {userFolder}!{Style.RESET_ALL}")

def main():
    """
    Main function to load configuration, fetch file links for each user,
    and download and extract the corresponding files.
    """
    args = parse_args()

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

    if args.user: # filter users by arg username
        users = [u for u in users if u["username"] in args.user]
        if not users:
            logging.warning("⚠️ No matching users found for the provided --user argument(s).")
            return
        
    for user in users:
        url = user["url"]
        username = user["username"]
        file_links = fetch_file_list_from_html(session, url,hour_str=args.hour)
        if file_links:
            download_and_extract(file_links, session, username)
        else:
            logging.error(f"⚠️ No file links found for {username}")


if __name__ == "__main__":
    main()
