import os
import sys
import time
import signal
import logging
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional


class ServiceManager:
    def __init__(self, script_path: str, name: str = None, log_dir: str = None):
        """
        Initialize the service manager.

        Args:
            script_path: Path to the Python script to run as a service
            name: Name of the service (defaults to script filename)
            log_dir: Directory for log files (defaults to current directory)
        """
        self.script_path = Path(script_path).resolve()
        if not self.script_path.exists():
            raise FileNotFoundError(f"Script not found: {script_path}")

        self.name = name or self.script_path.stem
        self.log_dir = Path(log_dir or os.getcwd())
        self.log_dir = self.log_dir / "nodetrack-client-logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Set up logging
        self.setup_logging()

        # PID file path
        self.pid_file = self.log_dir / f"{self.name}.pid"

        # Process handle
        self.process: Optional[subprocess.Popen] = None

    def setup_logging(self):
        """Configure logging for the service manager."""
        log_file = self.log_dir / f"{self.name}.log"

        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            handlers=[logging.FileHandler(log_file), logging.StreamHandler()],
        )
        self.logger = logging.getLogger(self.name)

    def write_pid(self, pid):
        """Write the process ID to the PID file."""
        with open(self.pid_file, "w") as f:
            f.write(str(pid))

    def read_pid(self) -> Optional[int]:
        """Read the process ID from the PID file."""
        try:
            with open(self.pid_file, "r") as f:
                return int(f.read().strip())
        except (FileNotFoundError, ValueError):
            return None

    def is_running(self) -> bool:
        """Check if the service is currently running."""
        pid = self.read_pid()
        if pid is None:
            return False

        try:
            os.kill(pid, 0)  # Send null signal to check process
            return True
        except (ProcessLookupError, PermissionError):
            return False

    def start(self):
        """Start the service in a detached process."""
        if self.is_running():
            self.logger.warning(f"Service {self.name} is already running")
            return

        try:
            # Prepare file paths for stdout and stderr
            stdout_file = self.log_dir / f"{self.name}.out"
            stderr_file = self.log_dir / f"{self.name}.err"

            # Create platform-specific startup info
            if os.name == "nt":  # Windows
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startupinfo.wShowWindow = subprocess.SW_HIDE
                creationflags = subprocess.CREATE_NEW_PROCESS_GROUP
            else:  # Unix-like
                startupinfo = None
                creationflags = 0

            # Open log files
            with open(stdout_file, "a") as stdout, open(stderr_file, "a") as stderr:
                # Start the script as a detached subprocess
                process = subprocess.Popen(
                    [sys.executable, str(self.script_path)],
                    stdout=stdout,
                    stderr=stderr,
                    stdin=subprocess.DEVNULL,
                    startupinfo=startupinfo,
                    creationflags=creationflags,
                    close_fds=True,  # Close parent file descriptors
                    cwd=str(
                        self.script_path.parent
                    ),  # Set working directory to script location
                    env=os.environ.copy(),  # Copy current environment
                )

                # Store the PID
                pid = process.pid
                self.write_pid(pid)

                self.logger.info(f"Started service {self.name} (PID: {pid})")

                # Don't wait for the process - let it run independently
                process.poll()

        except Exception as e:
            self.logger.error(f"Error starting service: {e}")
            self.stop()

    def stop(self):
        """Stop the service."""
        pid = self.read_pid()
        if not pid:
            self.logger.warning(f"No PID file found for service {self.name}")
            return

        try:
            if os.name == "nt":  # Windows
                subprocess.call(["taskkill", "/F", "/T", "/PID", str(pid)])
            else:  # Unix-like
                os.kill(pid, signal.SIGTERM)
                # Give it a moment to terminate gracefully
                time.sleep(1)
                # If it's still running, force kill
                try:
                    os.kill(pid, 0)
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass  # Process already terminated

            self.logger.info(f"Stopped service {self.name} (PID: {pid})")
        except ProcessLookupError:
            self.logger.warning(f"Process {pid} not found")
        except Exception as e:
            self.logger.error(f"Error stopping service: {e}")
        finally:
            if self.pid_file.exists():
                self.pid_file.unlink()

    def restart(self):
        """Restart the service."""
        self.stop()
        time.sleep(2)  # Give more time for process cleanup
        self.start()


def main():
    parser = argparse.ArgumentParser(description="Python Service Manager")
    parser.add_argument("script", help="Path to the Python script to run as a service")
    parser.add_argument("--name", help="Service name (defaults to script filename)")
    parser.add_argument("--log-dir", help="Directory for log files")
    parser.add_argument(
        "action",
        choices=["start", "stop", "restart", "status"],
        help="Action to perform",
    )

    args = parser.parse_args()

    service = ServiceManager(args.script, args.name, args.log_dir)

    if args.action == "start":
        service.start()
    elif args.action == "stop":
        service.stop()
    elif args.action == "restart":
        service.restart()
    elif args.action == "status":
        if service.is_running():
            pid = service.read_pid()
            print(f"Service {service.name} is running (PID: {pid})")
        else:
            print(f"Service {service.name} is not running")


if __name__ == "__main__":
    main()
