import json
from pathlib import Path 

def load_config(file_path: str | Path) -> dict:
    """Loads and returns the configuration JSON."""
    try:
        with open(file_path, "r", encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
       # logging.error(f"❌ Configuration file not found: '{file_path}'")
        raise
    except json.JSONDecodeError as e:
       # logging.error(f"❌ Failed to decode JSON from '{file_path}': {e}")
        raise
    except Exception as e:
       # logging.error(f"❌ Failed to load config '{file_path}': {type(e).name} - {e}")
        raise
    
    

