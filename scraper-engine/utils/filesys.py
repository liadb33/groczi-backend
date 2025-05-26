import argparse
from utils.constants import *

def determine_folder(file_name: str, user_folder: str) -> Path:
    base_folder = (
        XML_FOLDER_GROCERY_PATH if "price" in file_name.lower() else
        XML_FOLDER_STORE_PATH if "store" in file_name.lower() else
        XML_FOLDER_PROMOTION_PATH if "promo" in file_name.lower() else
        XML_OTHERS_FOLDER_PATH
    )
    return base_folder / user_folder



def parse_args():
    parser = argparse.ArgumentParser(description="Download and extract .gz files from store URLs.")
    parser.add_argument(
        "--hour",
        type=str,
        help="Hour to filter files (format: YYYYMMDDHH). Defaults to current hour - 1."
    )
    parser.add_argument(
        "--user",
        type=str,
        nargs="*",
        help="Username(s) to process. If not set, runs for all users."
    )
    return parser.parse_args()