import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import os
import urllib3
import gzip
import shutil
from pathlib import Path

# Disable SSL warning because we're setting verify=False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://prices.super-pharm.co.il/"
DOWNLOAD_PREFIX = "https://prices.super-pharm.co.il"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

today = datetime.now().strftime("%Y-%m-%d")


def scrape_superpharm(date=today):
    results = []
    page = 1

    while True:
        params = {"type": "", "date": date, "page": page}
        print(f"📄 Scraping Super-Pharm page {page}...")

        try:
            response = requests.get(BASE_URL, headers=HEADERS, params=params, verify=False)
            response.encoding = 'utf-8'
        except requests.exceptions.SSLError as e:
            print(f"❌ SSL error: {e}")
            break

        soup = BeautifulSoup(response.text, "html.parser")
        table = soup.find("table", class_="flat-table")
        if not table:
            print("❌ No table found, stopping.")
            break

        rows = table.find_all("tr")[1:]
        if not rows:
            break

        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 6:
                continue

            filename = cells[1].text.strip()
            timestamp = cells[2].text.strip()
            category = cells[3].text.strip()
            branch = cells[4].text.strip()
            download_tag = cells[5].find("a")

            if not download_tag or not download_tag.has_attr("href"):
                continue

            href = download_tag["href"]
            full_url = f"{DOWNLOAD_PREFIX}{href}"

            results.append({
                "network": "סופר-פארם",
                "filename": filename,
                "timestamp": timestamp,
                "category": category,
                "branch": branch,
                "url": full_url
            })

        page += 1

    return results


def download_and_extract(json_path, json_name):
    base_url = "https://prices.super-pharm.co.il"
    gz_dir = Path("D:/VsCode Projects/Groczi/Groczi/py-scrape/scrapes/files/gzFiles")
    xml_dir = Path(f"D:/VsCode Projects/Groczi/Groczi/py-scrape/scrapes/files/xmlFiles/{json_name}")
    gz_dir.mkdir(parents=True, exist_ok=True)
    xml_dir.mkdir(parents=True, exist_ok=True)

    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    for entry in data:
        getlink_url = entry["url"]
        timestamp_safe = entry["timestamp"].replace(":", "-").replace(" ", "_").replace("/", "-")
        filename_base = entry["filename"].replace(".gz", "")
        gz_filename = f'{filename_base}_{timestamp_safe}.gz'
        xml_filename = gz_filename.replace(".gz", ".xml")

        gz_path = gz_dir / gz_filename
        xml_path = xml_dir / xml_filename

        try:
            print(f"🔗 Getting real URL for {gz_filename}")
            redirect_resp = requests.get(getlink_url, verify=False)
            redirect_resp.raise_for_status()
            json_data = redirect_resp.json()

            if "href" not in json_data:
                print(f"⚠️ No 'href' in response: {json_data}")
                continue

            actual_url = base_url + json_data["href"]

            print(f"⬇️ Downloading from {actual_url}")
            gz_response = requests.get(actual_url, verify=False)
            gz_response.raise_for_status()

            # Ensure the response is a real GZIP file
            if not gz_response.content.startswith(b'\x1f\x8b'):
                print(f"❌ Not a valid .gz file (starts with: {gz_response.content[:20]})")
                continue

            with open(gz_path, "wb") as f_out:
                f_out.write(gz_response.content)

            with gzip.open(gz_path, "rb") as f_in:
                with open(xml_path, "wb") as f_out:
                    shutil.copyfileobj(f_in, f_out)

            print(f"✅ Extracted {xml_path.name}")
            gz_path.unlink()

        except Exception as e:
            print(f"❌ Error processing {getlink_url}: {e}")


def main():
    # Step 1: Scrape and save JSON
    data = scrape_superpharm()
    os.makedirs("shopsJsons", exist_ok=True)
    json_path = "shopsJsons/superpharm_data.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✅ Done. {len(data)} entries saved to {json_path}")

    # Step 2: Download + extract files
    download_and_extract(json_path, "superpharm_data")


if __name__ == "__main__":
    main()
