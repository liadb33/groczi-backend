import re
import json
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

def extract_files_json(html):
    """
    Searches the HTML for a line like:
      const files = JSON.parse(`[...]`).map(String);
    and extracts the JSON text from within the backticks.
    """
    # Updated pattern: allow for an optional ".map(String)" after the JSON.parse
    pattern = r'const\s+files\s*=\s*JSON\.parse\(`(.*?)`\)(?:\.map\(String\))?'
    match = re.search(pattern, html, re.DOTALL)
    if match:
        json_str = match.group(1)
        try:
            data = json.loads(json_str)
            return data
        except json.JSONDecodeError as e:
            print("Error parsing the JSON string:", e)
    else:
        print("Could not find the JSON data in the page source.")
    return None

def main():
    url = "https://prices.ybitan.co.il/"
    
    # Set up headless Chrome options.
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    try:
        print(f"Fetching {url} ...")
        driver.get(url)
        html = driver.page_source
        files_data = extract_files_json(html)
        
        if files_data is not None:
            print("Extracted JSON data:")
            print(json.dumps(files_data, indent=2, ensure_ascii=False))
            # Optionally, save to file:
            with open("files.json", "w", encoding="utf-8") as f:
                json.dump(files_data, f, indent=2, ensure_ascii=False)
        else:
            print("JSON data could not be extracted.")
    except Exception as e:
        print("An error occurred:", e)
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
