Here is the content for **`chapter-1.5.md`**, continuing the series of translations mapping advanced Python patterns to Node.js and PHP. 

This chapter focuses on **Graceful Shutdown, Task Cancellation, and OS Signals**, aligning with Lesson 1.5 of the core curriculum.

---

# chapter-1.5.md

When running containers in cloud environments like Kubernetes or AWS ECS, nodes are periodically restarted, scaled down, or redeployed. When the orchestrator decides to stop your container, it sends an OS-level termination signal (usually `SIGTERM`). 

If your application ignores this signal, it will be forcefully terminated after a grace period (typically 30 seconds), instantly cutting off active user database transactions or LLM API streams. To prevent data corruption and broken user connections, your application must implement a graceful shutdown mechanism.

---

## 🛑 1. Cooperative Cancellation & OS Signals

### The Mental Model: *The Restaurant Last Call*
Imagine a restaurant closing at midnight. 
* **Abrupt Shutdown:** At midnight, the manager suddenly turns off all the lights, locks the doors, and throws everyone out immediately. Diners leave hungry, and plates are left unwashed on tables.
* **Graceful Shutdown (The "Last Call"):** At 11:30 PM, the manager announces last call. The kitchen stops taking new orders (stops accepting new HTTP requests), the active diners are allowed to finish eating their meals (complete current database writes or active LLM streams), the staff washes the remaining dishes, and everyone departs in an orderly fashion.

In asynchronous software, we achieve this through **cooperative cancellation**. When a shutdown signal is intercepted, we instruct all running tasks to finish their current step or clean up before exiting.

---

### Python Code
In Python, cancellation is *cooperative* and *exception-based*. Calling `task.cancel()` raises an `asyncio.CancelledError` inside the coroutine at its next `await` point.

```python
import asyncio
import signal
import sys

async def process_data_stream(task_id: int):
    try:
        while True:
            print(f"Task {task_id}: Processing streaming tokens...")
            # Any 'await' point acts as a checkpoint for cancellation
            await asyncio.sleep(1.0)
    except asyncio.CancelledError:
        # Cooperatively intercept the cancellation to clean up resources
        print(f"Task {task_id}: Intercepted shutdown! Cleaning up database connections...")
        await asyncio.sleep(0.2)  # Simulate brief teardown work
        print(f"Task {task_id}: Cleanup complete.")
        # Re-raise is handled automatically by Python, but explicitly doing it or returning is required
        raise

async def shutdown(sig, loop):
    print(f"\nReceived signal {sig.name}. Initiating graceful shutdown...")
    
    # 1. Retrieve all running tasks
    all_tasks = asyncio.all_tasks()
    # Exclude the current shutdown task to avoid canceling ourselves
    tasks_to_cancel = [t for t in all_tasks if t is not asyncio.current_task()]
    
    # 2. Issue cooperative cancellation requests
    for task in tasks_to_cancel:
        task.cancel()
        
    # 3. Wait for all tasks to execute their 'except CancelledError' blocks
    await asyncio.gather(*tasks_to_cancel, return_exceptions=True)
    print("All tasks cleaned up successfully.")
    loop.stop()

def main():
    loop = asyncio.get_event_loop()
    
    # Register handlers for OS termination signals
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda s=sig: asyncio.create_task(shutdown(s, loop)))
        
    try:
        loop.create_task(process_data_stream(1))
        loop.run_forever()
    finally:
        loop.close()
        print("Process exited cleanly.")

if __name__ == "__main__":
    main()
```

---

### The Node.js Equivalent (AbortController & Signal Handlers)
Node.js processes listen to signals via `process.on()`. Because JavaScript promises do not have a native exception-based cancellation model like Python's `asyncio.CancelledError`, modern Node.js uses **`AbortController`** to cooperatively cancel pending async operations.

```javascript
const process = require('process');

// 1. Create an AbortController to signal cancellation across tasks
const controller = new AbortController();
const { signal } = controller;

async function processDataStream(taskId, abortSignal) {
    try {
        while (!abortSignal.aborted) {
            console.log(`Task ${taskId}: Processing streaming tokens...`);
            
            // We pass the abort signal down to timeout functions or network requests (e.g., fetch)
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(resolve, 1000);
                
                // If the signal is triggered, abort the promise early
                abortSignal.addEventListener('abort', () => {
                    clearTimeout(timeout);
                    reject(new Error("Operation Aborted"));
                });
            });
        }
    } catch (err) {
        if (err.message === "Operation Aborted") {
            console.log(`Task ${taskId}: Intercepted shutdown! Cleaning up database connections...`);
            // Perform asynchronous cleanup
            await new Promise(resolve => setTimeout(resolve, 200));
            console.log(`Task ${taskId}: Cleanup complete.`);
        } else {
            throw err;
        }
    }
}

// 2. Intercept OS Signals
const gracefulShutdown = async (signalName) => {
    console.log(`\nReceived ${signalName}. Initiating graceful shutdown...`);
    
    // Trigger cancellation
    controller.abort();
    
    // Give tasks a moment to run their catch blocks
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log("Process exited cleanly.");
    process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

processDataStream(1, signal);
```

---

### The PHP Equivalent (CLI Signals & FPM Lifecycles)
PHP treats lifecycles differently depending on whether it is running as a command-line script (CLI) or inside a web server interface (PHP-FPM):

#### A. The Web Model (PHP-FPM)
In PHP-FPM, request execution is short-lived. Graceful shutdown is managed entirely by PHP-FPM or Apache/Nginx. FPM handles active requests and waits for them to finish before stopping child workers. In standard FPM scripts, you rarely need to handle signals yourself; instead, you configure timeouts and database transaction rollbacks in your codebase.

#### B. The Daemon/CLI Model (Queue Workers / Long-running Daemons)
If you are running long-lived consumer scripts (like Laravel queue workers, Symfony commands, or RoadRunner / ReactPHP loops), you must capture signals manually using the `pcntl` extension:

```php
<?php
// Note: Requires pcntl extension enabled
declare(ticks=1);

class QueueWorker {
    private bool $shouldKeepRunning = true;

    public function __construct() {
        // Register signal handlers
        pcntl_signal(SIGINT, [$this, 'handleShutdown']);
        pcntl_signal(SIGTERM, [$this, 'handleShutdown']);
    }

    public function handleShutdown($signal) {
        echo "\nReceived termination signal. Stopping worker gracefully...\n";
        $this->shouldKeepRunning = false;
    }

    public function run() {
        while ($this->shouldKeepRunning) {
            echo "Processing streaming tasks...\n";
            sleep(1); // Simulate work step

            // Explicitly dispatch pending signals in PHP
            pcntl_signal_dispatch();
        }

        $this->cleanup();
    }

    private function cleanup() {
        echo "Performing database connection cleanup...\n";
        usleep(200000); // Simulate brief cleanup work (0.2s)
        echo "Cleanup complete. Process exited cleanly.\n";
    }
}

$worker = new QueueWorker();
$worker->run();
```

---

## 📊 Summary of Structural Differences

| Feature | Python (`asyncio`) | Node.js | PHP (CLI Daemon) |
| :--- | :--- | :--- | :--- |
| **Interruption Model** | **Exception-based:** `task.cancel()` raises `CancelledError` at the next await boundary. | **Token/Event-based:** Managed via `AbortController` or event listeners. | **Boolean/Dispatch-based:** Polled via `pcntl_signal_dispatch()` or checked via state variables. |
| **System Event Loops** | Native loop handles signal registration via `loop.add_signal_handler()`. | Node.js runtime registers signal listeners on the global `process` object. | PHP requires standard runtime extensions like `pcntl`, or libraries like ReactPHP/Swoole. |
| **Cleanup Implementation** | Written naturally inside `try/except asyncio.CancelledError:` blocks. | Written inside `catch (err)` or listener callbacks. | Executed sequentially once loop conditions evaluate to `false`. |