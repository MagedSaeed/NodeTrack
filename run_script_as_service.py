import os
import sys
import json
import time
import signal
import psutil
import logging
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
from tabulate import tabulate
from typing import Optional


class ServiceManager:
    def __init__(self, service_name: str, script_path: str = None, log_dir: str = None):
        """
        Initialize the service manager.

        Args:
            script_path: Path to the Python script to run as a service
            name: Name of the service
            log_dir: Directory for log files (defaults to current directory)
        """
        if script_path:
            self.script_path = Path(script_path).resolve()
            if not self.script_path.exists():
                raise FileNotFoundError(f"Script not found: {script_path}")

        self.service_name = service_name
        self.log_dir = Path(log_dir or os.getcwd())
        self.log_dir = self.log_dir / "nodetrack-client-logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Set up logging
        self.setup_logging()

        # PID file path
        self.pid_file = self.log_dir / f"{self.service_name}.pid"

        # Process handle
        self.process: Optional[subprocess.Popen] = None
        
        self.metadata_file = self.log_dir / f"{self.service_name}.meta.json"
        
        # Initialize or load metadata
        self.metadata = self.load_metadata()
        
        if script_path and not self.metadata.get('script_path'):
            self.metadata['script_path'] = str(self.script_path)
            self.save_metadata()

    def load_metadata(self) -> dict:
        """Load service metadata from JSON file."""
        try:
            with open(self.metadata_file, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {
                'created_at': datetime.now().isoformat(),
                'script_path': None,
                'last_start_time': None,
                'start_count': 0,
                'total_runtime': 0,
                'description': None
            }

    def save_metadata(self):
        """Save service metadata to JSON file."""
        with open(self.metadata_file, 'w') as f:
            json.dump(self.metadata, f, indent=2)

    def setup_logging(self):
        """Configure logging for the service manager."""
        log_file = self.log_dir / f"{self.service_name}.log"

        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            handlers=[logging.FileHandler(log_file), logging.StreamHandler()],
        )
        self.logger = logging.getLogger(self.service_name)

    def write_pid(self, pid):
        """Write the process ID to the PID file."""
        with open(self.pid_file, "w") as f:
            f.write(str(pid))

    def read_pid(self) -> Optional[int]:
        """Read the process ID from the PID file."""
        try:
            with open(self.pid_file, "r") as f:
                pid = int(f.read().strip())
                return pid
            
        except (FileNotFoundError, ValueError):
            return None

    def is_running(self) -> bool:
        """Check if the service is currently running."""
        pid = self.read_pid()
        if pid is None:
            return False

        try:
            return psutil.pid_exists(pid)
        except Exception:
            return False

    def start(self):
        """Start the service in a detached process."""
        if self.is_running():
            self.logger.warning(f"Service {self.service_name} is already running")
            return

        # Update metadata before starting
        self.metadata['last_start_time'] = datetime.now().isoformat()
        self.metadata['start_count'] += 1
        self.save_metadata()
        
        if self.is_running():
            self.logger.warning(f"Service {self.service_name} is already running")
            return

        try:
            # Prepare file paths for stdout and stderr
            stdout_file = self.log_dir / f"{self.service_name}.out"
            stderr_file = self.log_dir / f"{self.service_name}.err"

            # Create platform-specific startup info
            if os.name == "nt":  # Windows
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startupinfo.wShowWindow = subprocess.SW_HIDE
                
                creationflags = (
                    subprocess.CREATE_NEW_PROCESS_GROUP | 
                    subprocess.DETACHED_PROCESS | 
                    subprocess.CREATE_NO_WINDOW
                )
            else:  # Unix-like
                startupinfo = None
                creationflags = 0

            # Open log files
            assert self.script_path, "Script path is required for this operation"
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
                    cwd=str(self.script_path.parent),
                    env=os.environ.copy(),
                )

                # Store the PID
                pid = process.pid
                self.write_pid(pid)

                self.logger.info(f"Started service {self.service_name} (PID: {pid})")

                # Don't wait for the process - let it run independently
                process.poll()
            self.logger.info(f"Started service {self.service_name} (PID: {pid})")

        except Exception as e:
            self.logger.error(f"Error starting service: {e}")
            self.stop()
    
    def set_description(self, description: str):
        """Set a description for the service."""
        self.metadata['description'] = description
        self.save_metadata()
    
    def cleanup_service_files(self):
        """Clean up all files related to the service."""
        files_to_remove = [
            self.pid_file,                                          # PID file
            self.metadata_file,                                     # Metadata file
            self.log_dir / f"{self.service_name}.log",             # Log file
            self.log_dir / f"{self.service_name}.out",             # stdout file
            self.log_dir / f"{self.service_name}.err",             # stderr file
        ]
        
        for file_path in files_to_remove:
            try:
                if file_path.exists():
                    file_path.unlink()
                    self.logger.info(f"Removed file: {file_path}")
            except Exception as e:
                self.logger.error(f"Error removing file {file_path}: {e}")

    def stop(self, cleanup: bool = False):
        """
        Stop the service and optionally clean up all related files.
        
        Args:
            cleanup: If True, removes all service-related files after stopping
        """
        pid = self.read_pid()
        if not pid:
            self.logger.warning(f"No PID file found for service {self.service_name}")
            if cleanup:
                self.cleanup_service_files()
            return

        try:
            if os.name == "nt":  # Windows
                subprocess.call(["taskkill", "/F", "/T", "/PID", str(pid)])
            else:  # Unix-like
                os.kill(pid, signal.SIGTERM)
                # Give it a moment to terminate gracefully
                time.sleep(1)
                # If it's still running, force kill
                if psutil.pid_exists(pid):
                    os.kill(pid, signal.SIGKILL)

            self.logger.info(f"Stopped service {self.service_name} (PID: {pid})")
            
            # Update metadata before potential cleanup
            if not cleanup:
                stop_time = datetime.now()
                if self.metadata.get('last_start_time'):
                    start_time = datetime.fromisoformat(self.metadata['last_start_time'])
                    runtime = (stop_time - start_time).total_seconds()
                    self.metadata['total_runtime'] += runtime
                    self.save_metadata()
            
        except ProcessLookupError:
            self.logger.warning(f"Process {pid} not found")
        except Exception as e:
            self.logger.error(f"Error stopping service: {e}")
        finally:
            if self.pid_file.exists():
                self.pid_file.unlink()
            
            # Perform cleanup if requested
            if cleanup:
                self.cleanup_service_files()

    @classmethod
    def list_services(cls, log_dir: str = None) -> list[dict]:
        """List all available services in the log directory."""
        log_dir = Path(log_dir or os.getcwd())
        if not log_dir.exists():
            return []
            
        services = []
        for meta_file in log_dir.glob("nodetrack-client-logs/*.meta.json"):
            service_name = meta_file.stem.replace('.meta', '')
            service = cls(service_name, log_dir=str(log_dir))
            
            # Get service status
            is_running = service.is_running()
            pid = service.read_pid() if is_running else None
            
            # Calculate uptime if running
            uptime = None
            if is_running and service.metadata.get('last_start_time'):
                start_time = datetime.fromisoformat(service.metadata['last_start_time'])
                uptime = str(datetime.now() - start_time).split('.')[0]  # Remove microseconds
            
            services.append({
                "Name": service_name,
                "Status": "🟢 Running" if is_running else "🔴 Stopped",
                "PID": pid or "-",
                "Script": service.metadata.get('script_path') or "-",
                "Description": service.metadata.get('description') or "-",
                "Created": datetime.fromisoformat(service.metadata['created_at']).strftime("%Y-%m-%d %H:%M"),
                "Uptime": uptime or "-"
            })
            
        return services

def main():
    parser = argparse.ArgumentParser(description="Python Service Manager")
    parser.add_argument(
        "action",
        choices=["start", "stop", "status", "list", "describe"],
        help="Action to perform",
    )
    parser.add_argument(
        "service_name",
        nargs="?",
        help="Service name, required for start/stop/status/describe actions",
    )
    parser.add_argument(
        "--script",
        help="Path to the Python script to run as a service",
    )
    parser.add_argument("--log-dir", help="Directory for log files")
    parser.add_argument("--description", help="Service description (used with describe action)")
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Remove all service files when stopping (used with stop action)"
    )

    args = parser.parse_args()

    if args.action == "list":
        services = ServiceManager.list_services(args.log_dir)
        if not services:
            print("No services found")
        else:
            # Create a nice table using tabulate
            print("\nService Manager - Available Services")
            print(tabulate(
                services,
                headers="keys",
                tablefmt="pretty",
                numalign="left",
                stralign="left"
            ))
            print(f"\nTotal services: {len(services)}")
    
    elif args.action == "describe":
        if not args.service_name or not args.description:
            parser.error("Both service_name and --description are required for describe action")
        service = ServiceManager(args.service_name, args.script, args.log_dir)
        service.set_description(args.description)
        print(f"Updated description for service {args.service_name}")
    
    else:
        if not args.service_name:
            parser.error("service_name is required for start/stop/status actions")
            
        service = ServiceManager(args.service_name, args.script, args.log_dir)

        if args.action == "start":
            service.start()
        elif args.action == "stop":
            service.stop(cleanup=args.cleanup)
        elif args.action == "status":
            if service.is_running():
                pid = service.read_pid()
                print(f"Service {service.service_name} is running (PID: {pid})")
            else:
                print(f"Service {service.service_name} is not running")
main()