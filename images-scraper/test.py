# find_image.py
import sys
import io
import time
import random
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from duckduckgo_search import DDGS

def is_valid_barcode(code: str) -> bool:
    return code.isdigit() and len(code) == 13

def get_image_duckduckgo(itemcode: str, itemname: str) -> str | None:
    query = itemcode if is_valid_barcode(itemcode) else itemname
    with DDGS() as ddgs:
        results = ddgs.images(query, max_results=1)
        results = list(results)
        if results:
            return results[0]["image"]
    return None

if __name__ == "__main__":
    # האטה רנדומלית – 2 עד 7 שניות
    delay = random.uniform(2, 7)
    time.sleep(delay)

    itemcode = sys.argv[1] if len(sys.argv) > 1 else ""
    itemname = sys.argv[2] if len(sys.argv) > 2 else ""
    url = get_image_duckduckgo(itemcode, itemname)
    print(url or "")
