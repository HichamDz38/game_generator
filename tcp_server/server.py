import socket
import threading
import json
import redis
import time
import os
import requests

HOST = '0.0.0.0'  # Listen on all interfaces
PORT = 65432      # Port to listen on
connected_devices = {}
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
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.bind((host, port))
    server_socket.listen(5)  # Allow up to 5 pending connections
    print(f"Listening on {host}:{port}")

    while True:
        client_socket, addr = server_socket.accept()
        client_handler = threading.Thread(target=handle_client, args=(client_socket, addr))
        client_handler.start()


def register_device(device_info, addr):
    """Register device and return device_id, num_nodes"""
    num_nodes = device_info.get("num_nodes", 1)
    device_name = device_info.get("device_name", "")
    device_id = f"{addr[0]}:{device_name}"
    
    if num_nodes > 1:
        for i in range(num_nodes):
            instance_device_info = device_info.copy()
            instance_device_info["device_name"] = device_name+f"_{i+1}"
            update_device_info(device_id+f"_{i+1}", instance_device_info)
    else:
        update_device_info(device_id, device_info)
    
    return device_id, num_nodes


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
        
        if not node_id:
            print("[!] Warning: command has no node_id")
            return
        
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
    
    if num_nodes > 1:
        for i in range(num_nodes):
            remove_device(f"{device_id}_{i+1}")
    else:
        remove_device(device_id)


def handle_client(client_socket, addr):
    print(f"Accepted connection from {addr}")
    try:
        device_info = json.loads(client_socket.recv(4096).decode('utf-8'))
        device_id, num_nodes = register_device(device_info, addr)
    except Exception as e:
        print(f"[!] Error receiving initial device info: {e}")
        return

    index = 0
    while True:
        try:
            command = get_command_for_device(device_id, num_nodes, index)
                
            if command:
                process_command(client_socket, command, index)
            
            if num_nodes > 1:
                index = (index+1) % num_nodes
                
        except (socket.error, ConnectionResetError, BrokenPipeError) as e:
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


def update_device_info(device_id, device_info):
    """
    Update the device information in the connected_devices dictionary.
    """
    connected_devices[device_id] = device_info
    print(f"Updated device info: {connected_devices}")
    r.set(name="connected_devices", value=json.dumps(connected_devices))


def remove_device(device_id):
    """
    Remove the device from the connected_devices dictionary and Redis.
    """
    if device_id in connected_devices:
        del connected_devices[device_id]
        r.set(name="connected_devices", value=json.dumps(connected_devices))
        print(f"Removed device {device_id} from connected devices.")
    else:
        print(f"Device {device_id} not found in connected devices.")


if __name__ == "__main__":
    try:
        start_server(HOST, PORT)
    except Exception as e:
        print(f"An error occurred while starting the server: {e}")
        connected_devices = {}
        r.set(name="connected_devices", value=json.dumps(connected_devices))
        print("Server stopped.")
