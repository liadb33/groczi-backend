import requests
from bs4 import BeautifulSoup
import json
import re
import os
import gzip
import shutil
from pathlib import Path

def extract_file_table(url="https://laibcatalog.co.il/"):
    response = requests.get(url)
    response.encoding = "utf-8"  # Handle Hebrew characters
    soup = BeautifulSoup(response.text, "html.parser")

    table = soup.find("table")
    if not table:
        raise Exception("Table not found on the page.")

    rows = table.find_all("tr")[1:]  # Skip header
    data = []

    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 8:
            continue

        filename = cells[0].get_text(strip=True)
        network = cells[1].get_text(strip=True)
        branch = cells[2].get_text(strip=True)
        timestamp = cells[6].get_text(strip=True)

        link_tag = cells[7].find("a")
        if not link_tag or not link_tag.get("href"):
            continue

        href = link_tag["href"].replace("\\", "/")
        file_url = f"https://laibcatalog.co.il/{href.lstrip('/')}"
        store_id_match = re.search(r'/latest/(\d+)/', href)
        store_id = store_id_match.group(1) if store_id_match else "unknown"

        data.append({
            "network": network,
            "branch": branch,
            "store_id": store_id,
            "filename": filename,
            "url": file_url,
            "timestamp": timestamp
        })

    return data


def download_and_extract(json_path, json_name):
    gz_dir = Path("D:/VsCode Projects/Groczi/Groczi/py-scrape/scrapes/files/gzFiles")
    xml_dir = Path(f"D:/VsCode Projects/Groczi/Groczi/py-scrape/scrapes/files/xmlFiles/{json_name}")
    gz_dir.mkdir(parents=True, exist_ok=True)
    xml_dir.mkdir(parents=True, exist_ok=True)

    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    for entry in data:
        url = entry["url"]
        timestamp_safe = entry["timestamp"].replace(":", "-").replace(" ", "_").replace("/", "-")
        filename = f'{entry["store_id"]}_{timestamp_safe}.gz'
        gz_path = gz_dir / filename
        xml_path = xml_dir / filename.replace(".gz", ".xml")

        try:
            print(f"⬇️ Downloading {filename}")
            response = requests.get(url)
            response.raise_for_status()
            with open(gz_path, "wb") as f_out:
                f_out.write(response.content)

            with gzip.open(gz_path, "rb") as f_in:
                with open(xml_path, "wb") as f_out:
                    shutil.copyfileobj(f_in, f_out)

            print(f"✅ Extracted {xml_path.name}")
            gz_path.unlink()

        except Exception as e:
            print(f"❌ Error with {url}: {e}")


if __name__ == "__main__":
    results = extract_file_table()

    # Save to JSON
    json_filename = "victory_files.json"
    json_path = os.path.join("shopsJsons", json_filename)
    os.makedirs("shopsJsons", exist_ok=True)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"✅ Extracted {len(results)} entries to {json_filename}")

    # Download and extract files
    download_and_extract(json_path, "victory_files")
