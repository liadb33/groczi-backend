import argparse
import gzip
import zipfile
import shutil

from pathlib import Path
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

def extract_file(archive_path: Path, extracted_path: Path) -> None:
    """
    Extracts a .gz or .zip archive to the specified path.
    archive_path: full path ל־.gz או .zip
    extracted_path: היעד של הקובץ המוצא (למשל foo.xml)
    """
    with open(archive_path, "rb") as f:
        header = f.read(4)

    if header.startswith(b"PK"):
        # ZIP
        with zipfile.ZipFile(archive_path, "r") as z:
            members = z.namelist()
        
            member = members[0]
            z.extract(member, extracted_path.parent)
            extracted_file = extracted_path.parent / member
            if extracted_file != extracted_path:
                extracted_file.rename(extracted_path)
    else:
        # GZIP
        with gzip.open(archive_path, "rb") as zin, open(extracted_path, "wb") as zout:
            shutil.copyfileobj(zin, zout)