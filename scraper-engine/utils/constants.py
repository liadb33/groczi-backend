from pathlib import Path
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%d/%m/%Y %H:%M'
)

SCRIPT_DIR = Path(__file__).parent.resolve()

GZ_FOLDER_PATH = SCRIPT_DIR.parent / "output" / "gz"
XML_FOLDER_GROCERY_PATH = SCRIPT_DIR.parent / "output" / "groceries"
XML_FOLDER_STORE_PATH = SCRIPT_DIR.parent / "output" / "stores"
XML_FOLDER_PROMOTION_PATH = SCRIPT_DIR.parent / "output" / "promotions"
XML_OTHERS_FOLDER_PATH = SCRIPT_DIR.parent / "output" / "others"


def get_json_file_path(file_name: str) -> Path:
    """Returns the path to a JSON file in the 'configs' folder."""
    return SCRIPT_DIR.parent / "configs" / file_name