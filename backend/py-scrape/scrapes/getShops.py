import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
from urllib.parse import urlparse
import os
import gzip
import shutil
from pathlib import Path

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

today = datetime.now().strftime("%Y-%m-%d")

def extract_data(url):
    print(f"\n🌍 Fetching: {url}")
    domain = urlparse(url).netloc
    data = []
    page = 1

    while True:
        params = {"p": page, "d": today}
        response = requests.get(url, headers=HEADERS, params=params)
        response.encoding = "utf-8"
        soup = BeautifulSoup(response.text, "html.parser")
        table = soup.find("table")

        if not table:
            break

        rows = table.find_all("tr")[1:]
        if not rows:
            break

        for row in rows:
            cols = row.find_all("td")

            # Hazi Hinam format
            if domain.startswith("shop.hazi-hinam") and len(cols) >= 6:
                spans = cols[0].find_all("span")
                if len(spans) != 2:
                    continue
                timestamp = f"{spans[0].text.strip()} {spans[1].text.strip()}"
                store_id = cols[1].text.strip()
                filename = cols[2].text.strip()
                link = cols[5].find("a")
                if link and link.get("href"):
                    data.append({
                        "network": "חצי חינם",
                        "branch": "",
                        "store_id": store_id,
                        "filename": filename,
                        "url": link["href"].strip(),
                        "timestamp": timestamp
                    })

            # CityMarket format
            elif domain.startswith("www.citymarket") and len(cols) >= 7:
                timestamp = cols[0].get_text(strip=True).replace("\n", "")
                branch = cols[1].get_text(strip=True)
                store_id = cols[2].get_text(strip=True)
                filename = cols[3].get_text(strip=True)
                link = cols[6].find("a")
                if link and link.get("href"):
                    full_url = url.rstrip('/') + link["href"]
                    data.append({
                        "network": "סיטי מרקט",
                        "branch": branch,
                        "store_id": store_id,
                        "filename": filename,
                        "url": full_url,
                        "timestamp": f"{timestamp[:10]} {timestamp[10:]}"
                    })

        page += 1

    return data, domain


def download_and_extract(json_path, json_name):
    gz_dir = Path("D:/VsCode Projects/Groczi/Groczi/py-scrape/scrapes/files/gzFiles")
    xml_dir = Path(f"D:/VsCode Projects/Groczi/Groczi/py-scrape/scrapes/files/xmlFiles/{json_name}")
    gz_dir.mkdir(parents=True, exist_ok=True)
    xml_dir.mkdir(parents=True, exist_ok=True)

    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    for entry in data:
        url = entry["url"]
        timestamp_safe = entry["timestamp"].replace(":", "-").replace(" ", "_")
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

            # 🧹 Delete the .gz file after successful extraction
            gz_path.unlink()

        except Exception as e:
            print(f"❌ Error with {url}: {e}")


def main():
    with open("../jsons/shop.json", "r", encoding="utf-8") as f:
        config = json.load(f)

    os.makedirs("shopsJsons", exist_ok=True)

    for user in config["users"]:
        url = user["url"]
        result, domain = extract_data(url)

        domain_short = domain.replace("www.", "").split(".")[0]
        filename = f"{domain_short}_data.json"
        filepath = os.path.join("shopsJsons", filename)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        print(f"✅ Saved {len(result)} records → {filepath}")

        # 🔽 Add-on: download and extract files
        download_and_extract(filepath, domain_short)


if __name__ == "__main__":
    main()
