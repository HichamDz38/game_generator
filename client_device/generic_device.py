import socket
import json
import requests
from display import main as display_img
import time

class GeniricDevice():
    HOST = "localhost"  # The server's hostname or IP address
    PORT = 65432
    BACKEND_PORT = 5000

    def __init__(self, device_name, num_hints):
        self.device_info = {
            "device_name": device_name,
            "num_hints": num_hints,
            "status": "inactive",
            'config':{
                "image1":{
                    'type' : 'file',
                    'accept' : 'image/*',
                }
            }
        }

    # ---- Device State Control ----
    def start(self, config):
        
        
        backend_url = f"http://{self.HOST}:{self.BACKEND_PORT}"
        image_url = config["image1"]
        response = requests.get(backend_url+image_url)
        image_data = response.content
        with open("image.png", "wb") as f:
            f.write(image_data)
        display_img("image.png")
        self.device_info["status"] = "completed"
            

    def stop(self):
        self.device_info["status"] = "inactive"

    def reset(self):
        self.device_info["status"] = "active"

    def finish(self):
        self.device_info["status"] = "finished"

    # ---- Example Hint Handlers (to be extended) ----
    def hint1(self): print("[Hint1 executed]")
    def hint2(self): print("[Hint2 executed]")
    def hint3(self): print("[Hint3 executed]")
    def hint4(self): print("[Hint4 executed]")
    def hint5(self): print("[Hint5 executed]")
    def hint6(self): print("[Hint6 executed]")
    def hint7(self): print("[Hint7 executed]")
    def hint8(self): print("[Hint8 executed]")
    def hint9(self): print("[Hint9 executed]")
    def hint10(self): print("[Hint10 executed]")

    # ---- Main Socket Loop ----
    def connect(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect((self.HOST, self.PORT))
            print(f"[-] Device connected {self.device_info}")
            s.sendall(json.dumps(self.device_info).encode("utf-8"))
            while True:
                try:
                    data = s.recv(1024).decode("utf-8")
                    print(data)
                    if not data:
                        print("Connection closed by server.")
                        break
                    data = json.loads(data)
                    print(f"New Command: {data['command']}, : {data['node_id']}")
                    self.execute_command(data["command"], data["config"])
                    time.sleep(5)
                    s.sendall(json.dumps({"node_id":data['node_id'], "status": "success"}).encode("utf-8")) 
                except Exception as e:
                    print(f"[CLIENT ERROR] {e}")
                    s.sendall(json.dumps({"status": "error"}).encode("utf-8")) 
                    break

    def execute_command(self, cmd, config):
        if cmd == "start":
            self.start(config)
        elif cmd == "reset":
            self.reset()
        elif cmd == "finish":
            self.finish()
        elif cmd.startswith("hint"):
            try:
                getattr(self, cmd)()
            except AttributeError:
                print(f"Unknown hint command: {cmd}")
        else:
            print(f"Unknown command: {cmd}")
        # Always update status with last executed command
        self.device_info["last_command"] = cmd

    def receive_file(self, s, header):
        """Receive file sent from the server"""
        filename = header["filename"]
        filesize = header["size"]

        with open(filename, "wb") as f:
            remaining = filesize
            while remaining > 0:
                chunk = s.recv(min(1024, remaining))
                if not chunk:
                    break
                f.write(chunk)
                remaining -= len(chunk)

if __name__ == "__main__":
    DEVIC_NAME = "Device2"
    N_HINTS = 2
    device = GeniricDevice(DEVIC_NAME, N_HINTS)
    device.connect()
    
