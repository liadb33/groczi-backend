from datetime import datetime






def get_file_hour(timestamp_text: str) -> int:
    formats = [
        "%H:%M",                      
        "%m/%d/%Y %I:%M:%S %p",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%H:%M %d/%m/%Y",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(timestamp_text, fmt)
            return dt.hour
        except ValueError:
            continue
    raise ValueError(f"Unrecognized timestamp format: {timestamp_text}")