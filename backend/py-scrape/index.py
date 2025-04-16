import schedule
import time
from multiprocessing import Process
import importlib

def run_script(script_name):
    module = importlib.import_module(f"scrapes.{script_name}")
    if hasattr(module, "main"):
        module.main()
    else:
        print(f"{script_name}.py does not have a main() function")

def run_all_scripts():
    scripts = ["cerberus", "prices", "shops"]
    processes = []

    for script in scripts:
        p = Process(target=run_script, args=(script,))
        p.start()
        processes.append(p)

    for p in processes:
        p.join()

schedule.every().hour.at(":00").do(run_all_scripts)

print("📅 Scheduler started. Waiting for time to trigger...")

while True:
    schedule.run_pending()
    time.sleep(1)
