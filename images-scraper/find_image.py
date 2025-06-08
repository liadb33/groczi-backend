# find_image.py
import sys
import io
import time
import random
from duckduckgo_search import DDGS

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def is_valid_barcode(code: str) -> bool:
    return code.isdigit() and len(code) == 13

def get_product_image_duckduckgo(itemcode: str, itemname: str) -> str | None:
    query = itemcode if is_valid_barcode(itemcode) else itemname
    with DDGS() as ddgs:
        results = list(ddgs.images(query, max_results=1))
        if results:
            return results[0]["image"]
    return None

def get_subchain_image_duckduckgo(subchainname: str) -> str | None:
    with DDGS() as ddgs:
        results = list(ddgs.images(subchainname, max_results=1))
        if results:
            return results[0]["image"]
    return None

if __name__ == "__main__":
    # tiny random delay to avoid hammering DDG
    time.sleep(random.uniform(2, 7))

    mode = sys.argv[1].lower() if len(sys.argv) > 1 else "product"
    if mode == "subchain":
        subchainname = sys.argv[2] if len(sys.argv) > 2 else ""
        url = get_subchain_image_duckduckgo(subchainname)
    else:  # default to product
        itemcode = sys.argv[2] if len(sys.argv) > 2 else ""
        itemname = sys.argv[3] if len(sys.argv) > 3 else ""
        url = get_product_image_duckduckgo(itemcode, itemname)

    print(url or "")
