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
from typing import Optional
from tabulate import tabulate
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

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
            # Convert relative path to absolute path
            self.script_path = Path(script_path).resolve()
            if not self.script_path.exists():
                raise FileNotFoundError(f"Script not found: {script_path}")
        else:
            self.script_path = None

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
        
        # Metadata file path
        self.metadata_file = self.log_dir / f"{self.service_name}.meta.json"
        
        # Initialize or load metadata
        self.metadata = self.load_metadata()
        if self.metadata and self.metadata['script_path'] and self.script_path is None:
            self.script_path = self.metadata['script_path']
        
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
                return int(f.read().strip())
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

    def _get_python_path(self):
        # Get the Python executable path
        python_path = os.getenv('PYTHON_EXEC')
        if not python_path:
            raise ValueError(
                "PYTHON_EXEC not set in .env file. "
                "Please add PYTHON_EXEC=/path/to/your/venv/python"
            )
        
        python_path = Path(python_path)
        if not python_path.exists():
            raise ValueError(
                f"Python executable not found at {python_path}. "
                "Please check your PYTHON_EXEC path in .env"
            )
            
        return python_path
    
    def _resolve_paths_for_template(self) -> dict:
        """
        Resolve all paths needed for the service template.
        
        Returns:
            dict: Dictionary containing all resolved paths
        """
        if not self.script_path:
            raise ValueError("Script path is required for this operation")

        # Get the absolute path of the service manager script
        service_manager_path = Path(__file__).resolve()
        
        # Get the absolute path of the Python executable
        python_exe = self._get_python_path()
        
        # Ensure log paths are absolute
        stdout_path = (self.log_dir / f"{self.service_name}.out").resolve()
        stderr_path = (self.log_dir / f"{self.service_name}.err").resolve()
        
        return {
            'python_exe': str(python_exe),
            'script_path': str(service_manager_path),
            'target_script': str(self.script_path),
            'stdout_path': str(stdout_path),
            'stderr_path': str(stderr_path)
        }

    def start(self):        
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
                # On Windows, use pythonw.exe instead of python.exe to avoid console window
                if os.name == "nt":
                    # Get pythonw.exe path (same directory as the current Python executable)
                    python_exe_path = Path(sys.executable)
                    pythonw_exe = python_exe_path.parent / "pythonw.exe"
                    
                    if pythonw_exe.exists():
                        exe_path = str(pythonw_exe)
                    else:
                        # Fallback to regular python with hiding flags
                        exe_path = sys.executable
                else:
                    exe_path = sys.executable
                    
                process = subprocess.Popen(
                    [exe_path, str(self.script_path)],
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
            if is_running and service.metadata.get('created_at'):
                start_time = datetime.fromisoformat(service.metadata['created_at'])
                uptime = str(datetime.now() - start_time).split('.')[0]
            
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
        choices=[
            "start",
            "stop",
            "status",
            "list",
            "describe",
        ],
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

if __name__ == "__main__":
    main()