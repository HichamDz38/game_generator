import socket
import threading
import json
import redis
import time
import os
import requests
import os

HOST = '0.0.0.0'  # Listen on all interfaces
PORT = 65432      # Port to listen on
connected_devices = {}
backend_url = os.getenv("REACT_APP_API_BASE_URL")
backend_url = "http://192.168.16.240:5000"
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


def handle_client(client_socket, addr):
    device_id = f"{addr[0]}"
    print(f"Accepted connection from {addr}")
    try:
        device_info = json.loads(client_socket.recv(1024).decode('utf-8'))
        num_nodes = device_info.get("num_nodes", 1)
        if num_nodes > 1:
            for i in range(num_nodes):
                update_device_info(device_id+f"_{i+1}", device_info)
        else:
            update_device_info(device_id, device_info)
    except Exception as e:
        print(f"[!] Error receiving initial device info: {e}")
        return

    index = 0
    while True:
        try:
            if num_nodes > 1:
                command=get_device_command(f"{device_id}_{index+1}")
                index = (index+1) % num_nodes
            else:
                command=get_device_command(device_id)        
            if command:
                print(f"Got command {command}")
                command_data= json.loads(command)
                node_id = command_data["node_id"]
                r.set(f"flow_execution:{node_id}", "started")
                client_socket.sendall(command.encode("utf-8"))
                ack = json.loads(client_socket.recv(1024).decode('utf-8'))
                print(ack)
                if ack["status"] == "success":
                    r.set(f"flow_execution:{ack['node_id']}", "completed")
                else:
                    r.set(f"flow_execution:{ack['node_id']}", "failed")
                
        except Exception as e:
            print(f"An error occurred: {e}")
            client_socket.close()
            if num_nodes > 1:
                for i in range(num_nodes):
                    remove_device(f"{device_id}_{index+1}")
            else:
                remove_device(device_id)
            break


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
        r.set(name="connected_devices", value=str(connected_devices))
        print(f"Removed device {device_id} from connected devices.")
    else:
        print(f"Device {device_id} not found in connected devices.")


if __name__ == "__main__":
    try:
        start_server(HOST, PORT)
    except Exception as e:
        print(f"An error occurred while starting the server: {e}")
        connected_devices = {}
        r.set(name="connected_devices", value=str(connected_devices))
        print("Server stopped.")
