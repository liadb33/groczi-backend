from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import WebDriverException, TimeoutException
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By 
from utils.constants import *
import requests
from bs4 import BeautifulSoup

def perform_login(driver: webdriver.Chrome, username: str, password: str | None,login_url: str) -> bool:
    """Logs in using Selenium."""
    logging.info(f"Attempting login for {username}...")
    driver.get(login_url)
    try:
        user_field = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "username")))
        user_field.send_keys(username)
        if password:
            pass_field = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "password")))
            pass_field.send_keys(password)
       
        user_field.submit()
        WebDriverWait(driver, 15).until(EC.url_contains("/file"))
        logging.info(f"✅ Login successful for {username}")
        return True
    except WebDriverException as e:
        logging.error(f"❌ Login failed for {username}: {e}")
        return False
    
def perform_logout(driver: webdriver.Chrome,logout_url: str):
    """Logs out using Selenium."""
    logging.info("Attempting logout...")
    try:
        driver.get(logout_url)
        # Wait for an element that reliably appears on the login page after logout
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "username")))
        logging.info("✅ Logout successful.")
        return True
    except WebDriverException as e:
        logging.warning(f"⚠️ Logout navigation/check failed: {e}")
        return False



def transfer_cookies(driver: webdriver.Chrome, session: requests.Session):
    """Transfers cookies from Selenium WebDriver to requests Session."""
    logging.debug("Transferring cookies from WebDriver to requests session...")
    selenium_cookies = driver.get_cookies()
    for cookie in selenium_cookies:
        session.cookies.set(cookie['name'], cookie['value'], domain=cookie.get('domain'), path=cookie.get('path'))
    logging.debug(f"Transferred {len(selenium_cookies)} cookies.")



def get_csrf_token_from_page(driver: webdriver.Chrome) -> str | None:
     """Attempts to extract CSRF token directly from the Selenium driver's page source."""
     logging.debug("Attempting to extract CSRF token from page source...")
     try:
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, "html.parser")
        meta_tag = soup.find("meta", {"name": "csrftoken"})
        token = meta_tag["content"]
        return token
     except Exception as e:
        logging.error(f"Error extracting CSRF token from page source: {e}")
        return None
    

def access_site(driver: webdriver.Chrome, url: str,wait_selector: str) -> bool:
    logging.info(f"Accessing site: {url}")
    try:
        driver.get(url)
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, wait_selector))
        )
        
        return True
    except TimeoutException:
        logging.error(f"❌ Timed out waiting for site confirmation")
        return False
    except WebDriverException as e:
        logging.error(f"❌ Site access failed {e}")
        return False    
    except Exception as e:
        logging.error(f"❌ Error accessing {url}: {e}")
        return False