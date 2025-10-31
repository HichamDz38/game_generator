import socket
import threading
import json
import redis
import time
import os
import requests
import errno

HOST = '0.0.0.0'  # Listen on all interfaces
PORT = 65432      # Port to listen on
connected_devices = {}  # Logical devices (game nodes)
connected_physical_devices = {}  # Physical devices (monitors)
client_connections = {}  # Map device_id to client_socket for disconnect control
backend_url = os.getenv("REACT_APP_API_BASE_URL")

# Redis client
r = redis.Redis(host='redis', port=6379, decode_responses=True)


def send_file(client_socket, image_path):
    """Send a file to the client over the same socket using JSON header + raw bytes"""
    try:
        response = requests.get(f'{backend_url}/{image_path}')
        image_data = response.content
        filesize = len(image_data)
        header = {
            "type": "file",
            "filename": image_path,
            "size": filesize,
        }
        # Send header first, terminated by newline
        client_socket.sendall((json.dumps(header) + "\n").encode("utf-8"))
        client_socket.sendall(image_data)
        #with open(filename, "rb") as f:
            #while chunk := f.read(4096):
                #client_socket.sendall(chunk)

        print(f"[+] Sent {image_path} ({filesize} bytes)")
    except Exception as e:
        print(f"[!] Error sending file: {e}")


def start_server(host, port):
    server_running = r.get("tcp_server:status") == "running"
    while not server_running:
        print("[+] TCP Server STOPPED By Admin System...")
        time.sleep(10)
        server_running = r.get("tcp_server:status") == "running"

    print("[+] TCP Server is RUNNING...")
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind((host, port))
    server_socket.listen(5)  # Allow up to 5 pending connections
    server_socket.settimeout(1.0)  # Check for stop command every second
    print(f"Listening on {host}:{port}")
    
    # Set server status to running in Redis
    while True:
        if server_running:
            try:
                client_socket, addr = server_socket.accept()
                client_handler = threading.Thread(target=handle_client, args=(client_socket, addr))
                client_handler.start()
            except socket.timeout:
                # Normal timeout, continue loop to check status
                continue
            except Exception as e:
                print(f"[!] Error accepting connection: {e}")
            
        server_running = r.get("tcp_server:status") == "running"
        server_stopped = r.get("tcp_server:status") == "stopped"
        if server_stopped:
            print("[+] Server shutting down...")
            server_socket.close()
            time.sleep(2)
            return
        time.sleep(0.5)


def register_device(device_info, addr, client_socket):
    """Register device and return device_id, num_nodes, is_physical"""
    device_type = device_info.get("type", "logical")  # "logical" (default) or "physical"
    is_physical = (device_type == "physical")
    if is_physical:
        device_id = f"{addr[0]}"
        num_nodes = 1  # Physical devices are always single-node
    else:
        device_name = device_info.get("device_name", "")
        device_id = f"{addr[0]}:{device_name}"
        num_nodes = device_info.get("num_nodes", 1)
    # Store socket connection for disconnect control
    client_connections[device_id] = client_socket
    
    if num_nodes > 1:
        for i in range(num_nodes):
            instance_device_info = device_info.copy()
            instance_device_info["device_name"] = device_name+f"_{i+1}"
            update_device_info(device_id+f"_{i+1}", instance_device_info)
            client_connections[f"{device_id}_{i+1}"] = client_socket
    else:
        if is_physical:
            update_physical_device_info(device_id, device_info)
        else:
            update_device_info(device_id, device_info)
    
    return device_id, num_nodes, is_physical


def get_command_for_device(device_id, num_nodes, index):
    """Get command for device based on number of nodes"""
    if num_nodes > 1:
        return get_device_command(f"{device_id}_{index+1}")
    else:
        return get_device_command(device_id)


def process_command(client_socket, command, index):
    """Process and execute a command, return success status"""
    print(f"Got command {command}")
    node_id = None
    try:
        command_data = json.loads(command)
        command_data["index"] = index
        command = json.dumps(command_data)
        node_id = command_data.get("node_id")
        
        if node_id:
        
            r.set(f"flow_execution:{node_id}", "started")
        
        # Send command to device
        client_socket.sendall(command.encode("utf-8"))
        
        # Wait for acknowledgment from device
        ack_data = client_socket.recv(4096).decode('utf-8')
        if not ack_data:
            raise ConnectionError("Device disconnected - no acknowledgment received")
        
        ack = json.loads(ack_data)
        print(f"Device acknowledgment: {ack}")
        
        if ack.get("status") == "success":
            r.set(f"flow_execution:{ack['node_id']}", "completed")
        else:
            r.set(f"flow_execution:{ack['node_id']}", "failed")
            
    except (socket.error, ConnectionResetError, BrokenPipeError) as e:
        print(f"[!] Communication error with device: {e}")
        if node_id:
            r.set(f"flow_execution:{node_id}", "failed")
        raise  # Re-raise to trigger cleanup
        
    except json.JSONDecodeError as e:
        print(f"[!] Invalid JSON from device: {e}")
        if node_id:
            r.set(f"flow_execution:{node_id}", "failed")
        raise
        
    except Exception as e:
        print(f"[!] Error processing command: {e}")
        if node_id:
            r.set(f"flow_execution:{node_id}", "failed")
        raise


def cleanup_redis_data(device_id, num_nodes):
    """Clean up Redis data for device (commands, status, config)"""
    if num_nodes > 1:
        for i in range(num_nodes):
            instance_id = f"{device_id}_{i+1}"
            # Remove command queue
            r.delete(f"{instance_id}:commands")
            # Remove status
            r.delete(f"{instance_id}:status")
            # Remove config
            r.delete(f"{instance_id}:current_config")
            print(f"[+] Cleaned up Redis data for {instance_id}")
    else:
        # Remove command queue
        r.delete(f"{device_id}:commands")
        # Remove status
        r.delete(f"{device_id}:status")
        # Remove config
        r.delete(f"{device_id}:current_config")
        print(f"[+] Cleaned up Redis data for {device_id}")


def cleanup_device(device_id, num_nodes):
    """Remove device from connected devices and clean up Redis"""
    cleanup_redis_data(device_id, num_nodes)
    
    # Remove from client_connections
    if device_id in client_connections:
        del client_connections[device_id]
    
    if num_nodes > 1:
        for i in range(num_nodes):
            instance_id = f"{device_id}_{i+1}"
            remove_device(instance_id)
            if instance_id in client_connections:
                del client_connections[instance_id]
    else:
        remove_device(device_id)


def handle_client(client_socket, addr):
    print(f"Accepted connection from {addr}")
    # Check if server is stopping
    if r.get("tcp_server:status") == "stopped":
        print(f"[!] Server stopping, rejecting connection from {addr}")
        client_socket.close()
        return
    
    # Enable TCP keepalive to detect dead connections (more lenient settings)
    client_socket.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
    
    # Configure keepalive parameters (Linux-specific) - more lenient
    # After 60 seconds of idle, start sending keepalive probes
    # Send 3 probes, 10 seconds apart
    # If no response after 60 + (3 * 10) = 90 seconds, connection is dead
    try:
        client_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, 60)   # Start probes after 60s idle
        client_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPINTVL, 10)  # 10s between probes
        client_socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPCNT, 3)     # 3 probes before giving up
        print(f"[+] TCP keepalive enabled for {addr}")
    except AttributeError:
        # Not all platforms support these options
        print(f"[!] Platform doesn't support TCP keepalive configuration, using defaults")
    
    # No socket timeout - let keepalive handle dead connections
    # This prevents timeout errors during long waits for commands
    
    try:
        device_info = json.loads(client_socket.recv(4096).decode('utf-8'))
        device_id, num_nodes, is_physical = register_device(device_info, addr, client_socket)
    except Exception as e:
        print(f"[!] Error receiving initial device info: {e}")
        client_socket.close()
        return

    # Physical devices: just wait for direct commands (no queue polling, no disconnect)
    if is_physical:
        print(f"[+] Physical device {device_id} connected - waiting for direct commands")
        while True:
            # Check if server is stopping
            if r.get("tcp_server:status") == "stopped":
                print(f"[!] Server stopping, disconnecting physical device {device_id}")
                client_socket.close()
                cleanup_device(device_id, num_nodes)
                break
            
            # Check for physical device commands in Redis
            command_key = f"{device_id}:physical_command"
            command_json = r.get(command_key)
            if command_json:
                try:
                    # Delete command immediately to avoid re-processing
                    r.delete(command_key)
                    
                    command_data = json.loads(command_json)
                    print(f"[+] Sending command to physical device {device_id}: {command_data.get('action')}")
                    
                    # Send command to device
                    client_socket.sendall(command_json.encode("utf-8"))
                    
                    # Wait for response (with timeout)
                    client_socket.settimeout(30.0)
                    response_data = client_socket.recv(4096).decode('utf-8')
                    client_socket.settimeout(None)
                    
                    if response_data:
                        response = json.loads(response_data)
                        # Store response in Redis for Flask to retrieve
                        response_key = f"{device_id}:physical_response"
                        r.setex(response_key, 60, json.dumps(response))  # Expire after 60s
                        print(f"[+] Physical device response: {response.get('status')}")
                    else:
                        print(f"[!] No response from physical device {device_id}")
                        
                except socket.timeout:
                    print(f"[!] Timeout waiting for response from {device_id}")
                    error_response = {"status": "failed", "message": "Timeout"}
                    r.setex(f"{device_id}:physical_response", 60, json.dumps(error_response))
                except Exception as e:
                    print(f"[!] Error processing physical command: {e}")
                    error_response = {"status": "failed", "message": str(e)}
                    r.setex(f"{device_id}:physical_response", 60, json.dumps(error_response))
            
            # Physical devices: no disconnect command, no queue polling
            # They stay connected until server stops or connection dies
            time.sleep(0.2)  # Check for commands more frequently
        return

    # Logical devices: poll command queue (existing logic)
    index = 0
    
    while True:
        # Check if server is stopping
        if r.get("tcp_server:status") == "stopped":
            print(f"[!] Server stopping, disconnecting device {device_id}")
            client_socket.close()
            cleanup_device(device_id, num_nodes)
            break
            
        # Check if device should be disconnected
        disconnect_cmd = r.get(f"{device_id}:disconnect")
        if disconnect_cmd == "true":
            print(f"[!] Disconnect command received for device {device_id}")
            r.delete(f"{device_id}:disconnect")
            client_socket.close()
            cleanup_device(device_id, num_nodes)
            break
        
        try:
            command = get_command_for_device(device_id, num_nodes, index)
                
            if command:
                process_command(client_socket, command, index)
            
            if num_nodes > 1:
                index = (index+1) % num_nodes
                
        except (socket.error, ConnectionResetError, BrokenPipeError, ConnectionError) as e:
            print(f"[!] Communication error with device {device_id}: {e}")
            print(f"[!] Marking all pending operations as failed")
            
            # Mark any in-progress operations as failed
            if num_nodes > 1:
                for i in range(num_nodes):
                    instance_id = f"{device_id}_{i+1}"
                    # Check for any pending commands and mark as failed
                    pending_cmds = r.lrange(f"{instance_id}:commands", 0, -1)
                    for cmd in pending_cmds:
                        try:
                            cmd_data = json.loads(cmd)
                            if cmd_data.get('node_id'):
                                r.set(f"flow_execution:{cmd_data['node_id']}", "failed")
                        except:
                            pass
            else:
                # Check for any pending commands and mark as failed
                pending_cmds = r.lrange(f"{device_id}:commands", 0, -1)
                for cmd in pending_cmds:
                    try:
                        cmd_data = json.loads(cmd)
                        if cmd_data.get('node_id'):
                            r.set(f"flow_execution:{cmd_data['node_id']}", "failed")
                    except:
                        pass
            
            client_socket.close()
            cleanup_device(device_id, num_nodes)
            break
            
        except Exception as e:
            print(f"[!] Unexpected error with device {device_id}: {e}")
            client_socket.close()
            cleanup_device(device_id, num_nodes)
            break
            
        time.sleep(0.2)  # Avoid busy waiting


def get_device_command(device_id):
    """
    Retrieve the next command for a specific device from Redis.
    """
    return r.lpop(f"{device_id}:commands")


def send_direct_command_to_physical_device(device_id, command_data):
    """
    Send a direct command to a physical device (monitors) without using queue.
    Returns: (success: bool, message: str, response_data: dict)
    """
    if device_id not in client_connections:
        return False, f"Physical device {device_id} not connected", None
    
    client_socket = client_connections[device_id]
    
    try:
        # Send command directly
        command_json = json.dumps(command_data)
        client_socket.sendall(command_json.encode("utf-8"))
        
        # Wait for response (with timeout)
        client_socket.settimeout(30.0)  # 30 second timeout for physical operations
        response_data = client_socket.recv(4096).decode('utf-8')
        client_socket.settimeout(None)  # Reset to no timeout
        
        if not response_data:
            return False, "No response from device", None
        
        response = json.loads(response_data)
        
        if response.get("status") == "success":
            return True, response.get("message", "Success"), response.get("data")
        else:
            return False, response.get("message", "Failed"), response.get("data")
            
    except socket.timeout:
        return False, "Command timeout (30s)", None
    except Exception as e:
        return False, f"Error: {str(e)}", None


def update_device_info(device_id, device_info):
    """
    Update the device information in the connected_devices dictionary (logical devices).
    """
    connected_devices[device_id] = device_info
    print(f"Updated device info: {connected_devices}")
    r.set(name="connected_devices", value=json.dumps(connected_devices))


def update_physical_device_info(device_id, device_info):
    """
    Update the physical device information (monitors - separate namespace).
    """
    connected_physical_devices[device_id] = device_info
    print(f"Updated physical device info: {device_id}")
    r.set(name="connected_physical_devices", value=json.dumps(connected_physical_devices))


def remove_device(device_id):
    """
    Remove the device from connected_devices or connected_physical_devices and Redis.
    """
    # Try logical devices first
    if device_id in connected_devices:
        del connected_devices[device_id]
        r.set(name="connected_devices", value=json.dumps(connected_devices))
        r.delete(f"{device_id}:commands")
        r.delete(f"{device_id}:status")
        r.delete(f"{device_id}:current_config")
        print(f"Removed logical device {device_id}")
    # Try physical devices
    elif device_id in connected_physical_devices:
        del connected_physical_devices[device_id]
        r.set(name="connected_physical_devices", value=json.dumps(connected_physical_devices))
        # Physical devices don't have commands/status queues
        print(f"Removed physical device {device_id}")
    else:
        print(f"Device {device_id} not found in connected devices.")


if __name__ == "__main__":
    try:
        # Initialize server status
        r.set("tcp_server:status", "running")
        print("[+] TCP Server starting...")
        
        start_server(HOST, PORT)
    except KeyboardInterrupt:
        print("\n[!] Server interrupted by user")
        server_running = False
        r.set("tcp_server:status", "stopped")
    except Exception as e:
        print(f"An error occurred while starting the server: {e}")
        server_running = False
        r.set("tcp_server:status", "stopped")
    finally:
        connected_devices = {}
        r.set(name="connected_devices", value=json.dumps(connected_devices))
        print("Server stopped.")
