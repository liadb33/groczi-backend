import schedule
import time
import subprocess
import importlib

from multiprocessing import Process


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
    
    print("✅ All Python scripts finished. Now running stores.ts...")
    run_stores_ts()

def run_stores_ts():
    try:
        # זה הפקודה שאתה מריץ: node --loader ts-node/esm src/node-importer/stores.ts
        subprocess.run([
            "node", 
            "--loader", "ts-node/esm", 
            "./src/node-importer/stores.ts"
        ], check=True)
        print("✅ stores.ts finished successfully!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to run stores.ts: {e}")

schedule.every().hour.at(":00").do(run_all_scripts)

print("📅 Scheduler started. Waiting for time to trigger...")

while True:
    schedule.run_pending()
    time.sleep(1)
