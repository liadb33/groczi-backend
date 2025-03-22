import gzip
import os
import shutil
import requests
import json
import time
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime
from selenium.webdriver.common.keys import Keys
from datetime import datetime, timedelta

# Constants #
json_file_path = "../jsons/cerberus.json"
base_folder = "D:\\VsCode Projects\\Groczi\\Groczi\\py-scrape\\scrapes\\files"

####### function to find files #######
def find_files(driver):
    """If there's a folder on the file page, enter it. Then search and find .gz files for current or previous hour."""

    def enter_folder_if_needed(driver):
        try:
            # Wait for any folder links to be present
            folder_link = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.XPATH, "//a[contains(@class, 'fd') and contains(@href, '/file/d/')]"))
            )
            folder_name = folder_link.get_attribute("title") or folder_link.text
            print(f"Folder detected: '{folder_name}' - entering...")
            folder_link.click()

            # Wait for folder content to load
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//table"))
            )
            time.sleep(1)  # Small pause just in case
        except:
            print("No folder found, continuing directly to file search.")

    def perform_search(driver, date_hour):
        print(f"Searching with timestamp: {date_hour}")
        search_bar = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//input[@type='search']"))
        )
        search_bar.clear()
        search_bar.send_keys(date_hour)
        search_bar.send_keys(Keys.RETURN)
        time.sleep(2)

        # Scroll to load all files
        last_height = driver.execute_script("return document.body.scrollHeight")
        while True:
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                break
            last_height = new_height

        file_elements = driver.find_elements(By.XPATH, "//a[contains(@href, '.gz')]")
        return [elem.get_attribute("href") for elem in file_elements]

    # 1. If folder exists, enter it
    enter_folder_if_needed(driver)

    # 2. Try current hour
    now = datetime.now()
    timestamp = now.strftime("%Y%m%d%H")
    file_links = perform_search(driver, timestamp)

    if file_links:
        print(f"Found {len(file_links)} .gz files for {timestamp}")
        return file_links

    # 3. Fallback: try previous hour
    prev = now - timedelta(hours=1)
    prev_timestamp = prev.strftime("%Y%m%d%H")
    print(f"No files found for current hour. Trying previous hour: {prev_timestamp}")
    file_links = perform_search(driver, prev_timestamp)

    if file_links:
        print(f"Found {len(file_links)} .gz files for {prev_timestamp}")
    else:
        print("No .gz files found for current or previous hour.")

    return file_links

####### function to download files #######
def download_files(file_links, session_cookies, download_folder, xml_folder, username):

    # Create a unique folder for each user inside xmlFiles/
    user_xml_folder = os.path.join(xml_folder, username)
    os.makedirs(user_xml_folder, exist_ok=True)  # Ensure folder exists
    
    for file_link in file_links:
        try:
            file_name = file_link.split("/")[-1]
            gz_file_path = os.path.join(download_folder, file_name)
            extracted_file_path = os.path.join(user_xml_folder, file_name.replace(".gz", ".xml"))

            print(f"Downloading file: {file_name}")
            response = requests.get(file_link, cookies=session_cookies, stream=True)
            response.raise_for_status()

            with open(gz_file_path, "wb") as file:
                shutil.copyfileobj(response.raw, file)
               
            print(f"Downloaded: {file_name}")


            # Extract the .gz file
            print(f"Extracting: {file_name}")
            with gzip.open(gz_file_path, "rb") as gz_file:
                with open(extracted_file_path, "wb") as xml_file:
                    shutil.copyfileobj(gz_file, xml_file)
            
            print(f"Extracted: {file_name} -> {extracted_file_path}")
            
            # Delete the .gz file after extraction
            os.remove(gz_file_path)
            print(f"Deleted: {gz_file_path}")
        
        except Exception as e:
            print(f"Failed to process {file_link}. Error: {e}")




    
def main():
####### Check if the file exists #######
    try: 
        with open(json_file_path, "r") as json_file:
            cerberusJson = json.load(json_file)
    except FileNotFoundError:
        print("Error: cerberus.py : File not found")
        exit()
    except json.decoder.JSONDecodeError as e:
        print("Error: cerberus.py : Invalid JSON file")
        exit()

    ####### Check if the file is empty ######
    login_url = cerberusJson.get("url","")
    users_list = cerberusJson.get("users",[])

    ####### Check if the file has the required fields #######
    if not login_url:
        print("Error: cerberus.py : No login url found")
        exit()

    if not users_list or not isinstance(users_list, list):
        print("Error: cerberus.py : No users found")
        exit()

    # Creating relevant folders 
    download_folder = os.path.join(base_folder, "gzFiles")
    xml_folder = os.path.join(base_folder, "xmlFiles")
    os.makedirs(download_folder, exist_ok=True)
    os.makedirs(xml_folder, exist_ok=True)
    
    for users in users_list:
        username = users.get("username","")
        password = users.get("password","")

        if not username:
            print("Error: cerberus.py : No username found")
            exit()
        

        driver = webdriver.Chrome()
        driver.get(login_url)
        time.sleep(1)
        try:
            username_field = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "username")))
            username_field.send_keys(username)
            if password:
                password_field = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "password")))
                password_field.send_keys(password)
            
            username_field.submit()
            WebDriverWait(driver,10).until(EC.url_contains("/file"))

            print("Logged in successfully. Proceeding to the file page...")
            
            time.sleep(6)
            file_links = find_files(driver)
            
            # Get cookies for authenticated requests
            cookies = driver.get_cookies()
            session_cookies = {cookie['name']: cookie['value'] for cookie in cookies}

            download_files(file_links, session_cookies, download_folder, xml_folder, username)




            
        except Exception as e:
            print("Error: cerberus.py : Login failed")

        finally:
            driver.quit()


if __name__ == "__main__":
    main()


    








    
