import os
import json
import requests
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from requests.exceptions import RequestException

# Utils imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.json     import load_config
from utils.filesys  import determine_folder, parse_args, extract_file  # <-- import extract_file
from utils.constants import *
from utils.logging  import log_info, log_success, log_warn, log_error, log_critical

# Record script start and hour
SCRIPT_START      = datetime.now()
SCRIPT_START_HOUR = SCRIPT_START.hour

JSON_FILE_PATH = get_json_file_path("prices.json")


def fetch_file_list_from_html(session: requests.Session, url: str, hour_str: str | None = None) -> list[str] | None:
    """🌐 Parses the HTML page and returns a list of full download links for .gz files.

    Uses the script start time for default filtering (previous hour).
    """
    try:
        response = session.get(url, timeout=30)
        response.raise_for_status()

        pattern = r'const\s+files\s*=\s*JSON\.parse\(`(.*?)`\)\.map\(String\);'
        match = re.search(pattern, response.text, re.DOTALL)
        if not match:
            log_warn(f"No match found for files array in {url}")
            return None

        files_list = json.loads(match.group(1))

        date_str = SCRIPT_START.strftime("%Y%m%d")
        if hour_str is None:
            # default to one hour before script start
            hour_str = (SCRIPT_START).strftime("%Y%m%d%H")

        base_url = url.rstrip("/")
        filtered = [fn for fn in files_list if hour_str in fn]
        links = [f"{base_url}/{date_str}/{fn}" for fn in filtered]

        return links

    except json.JSONDecodeError as e:
        log_error(f"Failed to decode JSON from {url}: {e}")
        return None
    except RequestException as e:
        log_error(f"Request error while fetching HTML: {e}")
        return None
    except Exception as e:
        log_error(f"Unexpected error during HTML parsing ({type(e).__name__}): {e}")
        return None


def download_and_extract(file_links: list[str], session: requests.Session, user_folder: str) -> None:
    os.makedirs(GZ_FOLDER_PATH, exist_ok=True)
    failures = []
    log_info(f"     🗃 Starting downloads for user: {user_folder}")

    for link in file_links:
        name_gz = link.split("/")[-1]
        start = time.time()
        try:
            user_dir = determine_folder(name_gz, user_folder)
            os.makedirs(user_dir, exist_ok=True)

            gz_path   = Path(GZ_FOLDER_PATH) / name_gz
            xml_name  = name_gz.replace('.gz', '.xml')
            xml_path  = Path(user_dir) / xml_name

            with session.get(link, stream=True, timeout=30) as resp:
                resp.raise_for_status()
                with open(gz_path, 'wb') as f:
                    for chunk in resp.iter_content(8192):
                        if chunk:
                            f.write(chunk)

            extract_file(gz_path, xml_path)  # <-- use shared util
            gz_path.unlink()

            elapsed = time.time() - start
            log_success(f"✅ {name_gz} downloaded & extracted in {elapsed:.2f}s")

        except Exception as e:
            log_error(f"❌ Error for {name_gz}: {type(e).__name__} - {e}")
            failures.append(link)

    if failures:
        log_warn("⚠️ Some files failed to download:")
        for f in failures:
            log_error(f" - {f}")
    else:
        log_success(f"🎉 All files downloaded successfully for user {user_folder}!")


def main():
    args = parse_args()
    try:
        config = load_config(JSON_FILE_PATH)
    except Exception:
        log_critical("Failed to load configuration. Exiting.")
        return

    session = requests.Session()
    users   = config.get('users', [])
    if args.user:
        users = [u for u in users if u['username'] in args.user]
        if not users:
            log_warn("No matching users for provided --user argument(s). Exiting.")
            return

    for user in users:
        url  = user.get('url','')
        name = user.get('username','')
        if not url:
            log_warn(f"Missing URL for user {name}, skipping.")
            continue

        links = fetch_file_list_from_html(session, url, hour_str=args.hour)
        if links:
            download_and_extract(links, session, name)
        else:
            log_warn(f"No file links found for user {name}")


if __name__ == '__main__':
    main()
