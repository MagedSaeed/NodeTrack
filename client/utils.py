import socket
import netifaces


def get_first_non_loopback_ip():
    """Get the first non-loopback IP address"""
    for interface in netifaces.interfaces():
        addresses = netifaces.ifaddresses(interface)
        if netifaces.AF_INET in addresses:
            for link in addresses[netifaces.AF_INET]:
                ip_addr = link['addr']
                if not ip_addr.startswith('127.'):
                    return ip_addr # Return the first non-loopback IPv4 address found
    return None # No non-loopback IP found


def get_hostname():
    """Get the hostname of the machine"""
    return socket.gethostname()