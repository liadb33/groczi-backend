from colorama import Fore, Style, init

init(autoreset=True)

def log_info(message: str):
    """Prints an informational message in blue."""
    print(f"{Fore.CYAN}{message}{Style.RESET_ALL}")

def log_success(message: str):
    """Prints a success message in green."""
    print(f"{Fore.GREEN}{message}{Style.RESET_ALL}")

def log_warn(message: str):
    """Prints a warning message in yellow."""
    print(f"{Fore.YELLOW}{message}{Style.RESET_ALL}")

def log_error(message: str):
    """Prints an error message in red."""
    print(f"{Fore.RED}{message}{Style.RESET_ALL}")

def log_critical(message: str):
    """Prints a critical message in bold red."""
    print(f"{Style.BRIGHT}{Fore.RED}{message}{Style.RESET_ALL}")
