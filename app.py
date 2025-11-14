from flask import Flask, render_template, jsonify, request , send_from_directory
from flask_cors import CORS
import os
import redis
import json
from werkzeug.utils import secure_filename
import datetime
import uuid
import time
from time import sleep
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)



redis_client = redis.Redis(host='redis', port=6379, decode_responses=True)




app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size for images
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}
app.config['ALLOWED_VIDEO_EXTENSIONS'] = {'mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'}
app.config['MAX_VIDEO_SIZE'] = 100 * 1024 * 1024  # 100MB max for videos


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def allowed_video_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_VIDEO_EXTENSIONS']

CORS(app)

CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",      
            "http://frontend:3000",      
            "http://10.48.12.4:3000"     
        ],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type"]
    }
})

prop_status = {i: 'Not activated' for i in range(1, 9)}

@app.route('/')
def index():
    return render_template('index.html', prop_status=prop_status, page_title = "My Dashboard")

@app.route('/get_devices', methods=['GET'])
def get_devices():
    try:
        return json.loads(redis_client.get("connected_devices") or {})
    except Exception as e:
        print(f"Error getting devices: {e}")
        return json.dumps({})
    
    
@app.route('/delete_scenario/<scenario_name>', methods=['DELETE'])
def delete_scenario(scenario_name):
    if not scenario_name or scenario_name == 'undefined':
        return jsonify({"error": "Invalid scenario name"}), 400
        
    flow_data = redis_client.get(f"scenario_{scenario_name}")
    if not flow_data:
        return jsonify({"error": "Scenario not found"}), 404
        
    redis_client.delete(f"scenario_{scenario_name}")
    redis_client.lrem("scenarios_list", 0, scenario_name)
    return jsonify({"message": "Scenario deleted"}), 200

@app.route('/rename_scenario/<old_name>/<new_name>', methods=['PUT'])
def rename_scenario(old_name, new_name):
    flow_data = redis_client.get(f"scenario_{old_name}")
    if not flow_data:
        return jsonify({"error": "Scenario not found"}), 404
    if redis_client.exists(f"scenario_{new_name}"):
        return jsonify({"error": "Scenario with this name already exists"}), 400 
    redis_client.rename(f"scenario_{old_name}", f"scenario_{new_name}")    
    redis_client.lrem("scenarios_list", 0, old_name)
    redis_client.lpush("scenarios_list", new_name)
        
    return jsonify({"message": "Scenario renamed successfully"}), 200
    
@app.route('/copy_scenario/<original_name>/<new_name>', methods=['POST'])
def copy_scenario(original_name, new_name):

    flow_data = redis_client.get(f"scenario_{original_name}")
    if not flow_data:
        return jsonify({"error": "scenario not found"}), 404
    if redis_client.exists(f"scenario_{new_name}"):
        return jsonify({"error": "name already exists"}), 400
    redis_client.set(f"scenario_{new_name}", flow_data)    
    redis_client.lpush("scenarios_list", new_name)    
    return jsonify({
        "message": "Scenario copied successfully",  
        "new_name": new_name
    }), 200


@app.route('/save_flow', methods=['POST'])
def save_flow():
    flow_data = request.get_json()
    flow_name = flow_data["name"]
    del flow_data["name"]
    if not flow_data:
        return jsonify({'message': 'No data provided'}), 400


    redis_client.set(f"scenario_{flow_name}",json.dumps(flow_data))
    previous_scenario = redis_client.lrange("scenarios_list", 0, -1)
    if flow_name not in previous_scenario:
        redis_client.lpush("scenarios_list", flow_name)

    return jsonify({
    'message': 'Flow data received successfully2',
    'flow_id': flow_name 
    }), 200


@app.route('/flow_scenarios', methods=['GET'])
def get_scenarios():
    try:
        return list(set(redis_client.lrange(f"scenarios_list", 0, -1)))
    except:
        pass


@app.route('/load-flow/<flow_id>', methods=['GET'])
def load_flow(flow_id):
    try:
        flow_data = redis_client.get(f"scenario_{flow_id}")
        if not flow_data:
            return jsonify({"error": "Flow not found"}), 404
            
        return jsonify(json.loads(flow_data))
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/reset/<device_id>', methods=['POST'])
def reset(device_id):
    redis_client.lpush(f'{device_id}:commands', "reset")
    return jsonify({'status': 'success'})

@app.route('/start/<device_id>', methods=['POST'])
def start(device_id):
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        config = data.get('config', {})
        node_id = data.get('nodeId')
        scenario_name = data.get('scenarioName')
        
        logger.info(f"Starting device {device_id} for node {node_id} in scenario {scenario_name}")
        logger.info(f"Device config: {config}")

        processed_config = {}
        for key, value in config.items():
            if value == "null":
                processed_config[key] = None
            else:
                processed_config[key] = value
        
        redis_client.set(f'{device_id}:current_config', json.dumps(config))
        logger.info(f"Stored config for device {device_id}")

        
        simple_config = {}
        for key, value in config.items():
            if value == "null":
                simple_config[key] = None  
            else:
                simple_config[key] = value
        
        redis_client.set(f'{device_id}:status', 'in progress')
        
        command_data = {
            'command': 'start',
            'config': simple_config,
            'node_id': node_id,
            'scenario_name': scenario_name
        }
        redis_client.lpush(f'{device_id}:commands', json.dumps(command_data))
        
        logger.info(f"Device {device_id} started with command: {command_data}")
        
        return jsonify({
            'status': 'success',
            'message': f'Device {device_id} started successfully',
            'deviceId': device_id,
            'nodeId': node_id,
            'config': simple_config,
            'device_status': 'in progress'
        })
        
    except Exception as e:
        logger.error(f"Error starting device {device_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Device start failed: {str(e)}',
            'deviceId': device_id,
            'nodeId': data.get('nodeId') if 'data' in locals() else None
        }), 500


@app.route('/finish/<device_id>', methods=['POST'])
def finish(device_id):
    redis_client.lpush(f'{device_id}:commands', "finish")
    return jsonify({'status': 'success'})

@app.route('/stop/<device_id>', methods=['POST'])
def stop_device(device_id):
    """
    Stop a specific client device by restarting its service on the physical device.
    This ensures the device stops immediately, even if it's busy executing commands.
    
    Device ID format: "IP:device_name" (e.g., "192.168.16.195:epaper")
    Service name format: "Client_Device_{device_name}.service"
    """
    try:
        logger.info(f"Stopping device {device_id} via service restart...")
        
        # Parse device_id format: "IP:device_name"
        if ':' not in device_id:
            return jsonify({
                'status': 'error',
                'message': f'Invalid device_id format: {device_id}. Expected "IP:device_name"'
            }), 400
        
        physical_ip, device_name = device_id.split(':', 1)
        service_name = f"Client_Device_{device_name}.service"
        
        # Send restart command to physical device
        command = {
            "action": "restart_device",
            "params": {"device_service": service_name}
        }
        
        success, message, _ = send_physical_device_command(
            physical_ip, 
            command, 
            timeout=10
        )
        
        if success:
            logger.info(f"✓ Successfully restarted {service_name} on {physical_ip}")
            return jsonify({
                'status': 'success',
                'message': f'Device {device_id} stopped successfully',
                'deviceId': device_id,
                'service': service_name
            }), 200
        else:
            logger.error(f"✗ Failed to restart {service_name}: {message}")
            return jsonify({
                'status': 'error',
                'message': f'Failed to stop device: {message}',
                'deviceId': device_id
            }), 500
        
    except Exception as e:
        logger.error(f"Error stopping device {device_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to stop device: {str(e)}'
        }), 500

@app.route('/hint/<device_id>/<hint_id>', methods=['POST'])
def send_hint(device_id, hint_id):
    redis_client.lpush(f'{device_id}:commands', hint_id)
    return jsonify({'status': 'success'})

@app.route('/start_all', methods=['POST'])
def start_all():
    connected_dev = redis_client.get("connected_devices")
    if connected_dev:
        devices = json.loads(connected_dev.replace("'", '"'))
        for device_id in devices.keys():
            redis_client.lpush(f'{device_id}:commands', "start")
    return jsonify({'status': 'success'})

@app.route('/reset_all', methods=['POST'])
def reset_all():
    connected_dev = redis_client.get("connected_devices")
    if connected_dev:
        devices = json.loads(connected_dev.replace("'", '"'))
        for device_id in devices.keys():
            redis_client.lpush(f'{device_id}:commands', "reset")
    return jsonify({'status': 'success'})

@app.route('/clear_all_commands', methods=['POST'])
def clear_all_commands():
    """Clear all pending commands from all connected devices"""
    try:
        connected_dev = redis_client.get("connected_devices")
        if not connected_dev:
            return jsonify({
                'status': 'success',
                'message': 'No devices connected',
                'devices_cleared': 0
            }), 200
        
        devices = json.loads(connected_dev.replace("'", '"'))
        cleared_count = 0
        
        for device_id in devices.keys():
            # Delete the entire command queue for each device
            redis_client.delete(f'{device_id}:commands')
            cleared_count += 1
        
        logger.info(f"Cleared command queues for {cleared_count} devices")
        return jsonify({
            'status': 'success',
            'message': f'Cleared commands for {cleared_count} devices',
            'devices_cleared': cleared_count
        }), 200
        
    except Exception as e:
        logger.error(f"Error clearing commands: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to clear commands: {str(e)}'
        }), 500

@app.route('/stop_all', methods=['POST'])
def stop_all():
    """
    Stop all connected client devices by restarting their services on physical devices.
    Waits for all devices to reconnect (max 2 minutes timeout).
    
    Device ID format: "IP:device_name" (e.g., "192.168.16.195:epaper")
    Service name format: "Client_Device_{device_name}.service"
    """
    import time
    
    try:
        logger.info("Stopping all client devices via service restart...")
        
        connected_dev = redis_client.get("connected_devices")
        if not connected_dev:
            logger.info("No connected devices found")
            return jsonify({
                'status': 'success',
                'message': 'No devices to stop',
                'devices_stopped': 0
            }), 200
        
        devices = json.loads(connected_dev.replace("'", '"'))
        original_device_ids = set(devices.keys())
        
        # Group devices by physical device (IP)
        physical_devices_map = {}
        for device_id in devices.keys():
            try:
                # Parse device_id format: "IP:device_name"
                if ':' not in device_id:
                    logger.warning(f"Skipping malformed device_id: {device_id}")
                    continue
                
                ip, device_name = device_id.split(':', 1)
                
                if ip not in physical_devices_map:
                    physical_devices_map[ip] = []
                
                physical_devices_map[ip].append({
                    'device_id': device_id,
                    'device_name': device_name,
                    'service_name': f"Client_Device_{device_name}.service"
                })
                
            except Exception as e:
                logger.error(f"Error parsing device_id {device_id}: {str(e)}")
                continue
        
        # Restart services on each physical device
        restart_success_count = 0
        restart_failed_count = 0
        restart_results = []
        
        for physical_ip, client_devices in physical_devices_map.items():
            logger.info(f"Stopping {len(client_devices)} client(s) on physical device {physical_ip}")
            
            for client in client_devices:
                try:
                    # Send restart command to physical device
                    command = {
                        "action": "restart_device",
                        "params": {"device_service": client['service_name']}
                    }
                    
                    success, message, _ = send_physical_device_command(
                        physical_ip, 
                        command, 
                        timeout=10
                    )
                    
                    if success:
                        logger.info(f"✓ Restarted service: {client['service_name']} on {physical_ip}")
                        restart_success_count += 1
                        restart_results.append({
                            'device_id': client['device_id'],
                            'restart_status': 'success',
                            'message': message
                        })
                    else:
                        logger.error(f"✗ Failed to restart {client['service_name']}: {message}")
                        restart_failed_count += 1
                        restart_results.append({
                            'device_id': client['device_id'],
                            'restart_status': 'failed',
                            'message': message
                        })
                        
                except Exception as e:
                    logger.error(f"Error restarting {client['device_id']}: {str(e)}")
                    restart_failed_count += 1
                    restart_results.append({
                        'device_id': client['device_id'],
                        'restart_status': 'error',
                        'message': str(e)
                    })
        
        logger.info(f"Services restart complete: {restart_success_count} successful, {restart_failed_count} failed")
        
        # Now wait for devices to reconnect (2 minute timeout)
        logger.info(f"Waiting for {len(original_device_ids)} devices to reconnect (timeout: 120s)...")
        
        RECONNECT_TIMEOUT = 120  # 2 minutes
        CHECK_INTERVAL = 2  # Check every 2 seconds
        start_time = time.time()
        
        reconnected_devices = set()
        while time.time() - start_time < RECONNECT_TIMEOUT:
            # Check which devices are now connected
            current_connected = redis_client.get("connected_devices")
            if current_connected:
                current_devices = json.loads(current_connected.replace("'", '"'))
                reconnected_devices = set(current_devices.keys()) & original_device_ids
                
                if reconnected_devices == original_device_ids:
                    elapsed = time.time() - start_time
                    logger.info(f"✓ All {len(original_device_ids)} devices reconnected in {elapsed:.1f}s")
                    break
                
                logger.info(f"Reconnected: {len(reconnected_devices)}/{len(original_device_ids)} devices...")
            
            time.sleep(CHECK_INTERVAL)
        
        # Check final status
        elapsed_time = time.time() - start_time
        missing_devices = original_device_ids - reconnected_devices
        
        if len(missing_devices) == 0:
            logger.info(f"✓ SUCCESS: All devices reconnected in {elapsed_time:.1f}s")
            return jsonify({
                'status': 'success',
                'message': f'All {len(original_device_ids)} devices stopped and reconnected',
                'devices_restarted': restart_success_count,
                'devices_reconnected': len(reconnected_devices),
                'reconnect_time': round(elapsed_time, 1),
                'details': restart_results
            }), 200
        else:
            logger.warning(f"⚠ TIMEOUT: {len(missing_devices)} devices failed to reconnect after {elapsed_time:.1f}s")
            logger.warning(f"Missing devices: {missing_devices}")
            
            return jsonify({
                'status': 'timeout',
                'message': f'{len(reconnected_devices)}/{len(original_device_ids)} devices reconnected. {len(missing_devices)} failed.',
                'devices_restarted': restart_success_count,
                'devices_reconnected': len(reconnected_devices),
                'devices_missing': len(missing_devices),
                'missing_device_ids': list(missing_devices),
                'reconnect_time': round(elapsed_time, 1),
                'details': restart_results
            }), 200
        
    except Exception as e:
        logger.error(f"Error stopping all devices: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to stop all devices: {str(e)}'
        }), 500


@app.route('/set_random_devices', methods=['GET'])
def save_random_device_config():
    
    devices_list = {
        '127.0.0.1:34914': {
            'device_name': 'shelf',
            'num_hints': 2,
            'status': 'active',
            'config':{
                "solution":{
                    'type' : 'matrix',
                    'required': True
                },
                "direction": {
                'type': 'select',
                'options': ["LEFT", "RIGHT"],
                'required': True
                },
                "level": {
                    'type': 'select',
                    'options': ["UP", "DOWN"],
                    'required': True
                },
                "display_input_0": {
                    'type': 'text',
                    'required': False,
                    'conditional': [
                        {'dependsOn': 'direction', 'values': ['LEFT']},
                        {'dependsOn': 'level', 'values': ['UP']}
                    ]
                },
                "display_input_1": {
                    'type': 'checkbox',
                    'required': False,
                    'conditional': [
                        {'dependsOn': 'direction', 'values': ['RIGHT']},
                        {'dependsOn': 'level', 'values': ['DOWN']}
                    ]
                }
            }
        },
        '127.0.0.1:35054': {
            'device_name': 'Device2', 
            'num_hints': 2,
            'status': 'active',
            'config':{
                "num_players":{
                    'type' : 'number',
                    'required': True
                },
                "message":{
                    'type' : 'text',
                    'required': True
                }
            }
        },
        '127.0.0.1:350004': {
            'device_name': 'Device3', 
            'num_hints': 2,
            'status': 'active',
            'config':{
                "Agree!":{
                    'type' : 'checkbox',
                    'required': True
                },
                "image1":{
                    'type' : 'file',
                    'accept' : 'image/*',
                    'required': True
                }
            }
        },
        'node': {
            'device_name': 'Image',
            'num_hints': 2,
            'status': 'active',
            'config':{
                "image1":{
                    'type' : 'file',
                    'accept' : 'image/*',
                    'required': True
                },
                "image2":{
                    'type' : 'file',
                    'accept' : 'image/*',
                    'required': True
                },
                "image3":{
                    'type' : 'file',
                    'accept' : 'image/*',
                    'required': True
                },
                "Do you agree !":{
                    'type' : 'checkbox',
                    'value' : 'yes',
                    'required': True
                }
            }
        },
        }
    redis_client.set("connected_devices", json.dumps(devices_list))
    return json.loads(redis_client.get("connected_devices"))


@app.route('/upload-image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        field_name = request.form.get('fieldName', '')
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{field_name}_{timestamp}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        file.save(filepath)
        image_url = f"/static/uploads/{unique_filename}"
        
        node_id = request.form.get('nodeId')
        scenario_name = request.form.get('scenarioName')
        field_name = request.form.get('fieldName')
        
        if node_id and scenario_name and field_name:
            scenario_key = f"scenario_{scenario_name}"
            scenario_data = redis_client.get(scenario_key)
            
            if scenario_data:
                scenario_data = json.loads(scenario_data)
                for node in scenario_data.get('nodes', []):
                    if (node['id'] == node_id and 
                        'config' in node.get('data', {}) and 
                        field_name in node['data']['config']):
                        node['data']['config'][field_name]['value'] = image_url
                
                redis_client.set(scenario_key, json.dumps(scenario_data))
        
        return jsonify({
            'message': 'File uploaded successfully',
            'imageUrl': image_url,
            'fieldName': field_name
        }), 200
    
    return jsonify({'error': 'Invalid file type'}), 400


@app.route('/upload-video', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400
    
    file = request.files['video']
    if file.filename == '':
        return jsonify({'error': 'No video file selected'}), 400
    
    # Check file size for videos (allow up to 100MB)
    if file and allowed_video_file(file.filename):
        filename = secure_filename(file.filename)
        field_name = request.form.get('fieldName', '')
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{field_name}_{timestamp}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        file.save(filepath)
        video_url = f"/static/uploads/{unique_filename}"
        
        node_id = request.form.get('nodeId')
        scenario_name = request.form.get('scenarioName')
        field_name = request.form.get('fieldName')
        
        if node_id and scenario_name and field_name:
            scenario_key = f"scenario_{scenario_name}"
            scenario_data = redis_client.get(scenario_key)
            
            if scenario_data:
                scenario_data = json.loads(scenario_data)
                for node in scenario_data.get('nodes', []):
                    if (node['id'] == node_id and 
                        'config' in node.get('data', {}) and 
                        field_name in node['data']['config']):
                        node['data']['config'][field_name]['value'] = video_url
                
                redis_client.set(scenario_key, json.dumps(scenario_data))
        
        return jsonify({
            'message': 'Video uploaded successfully',
            'videoUrl': video_url,
            'fieldName': field_name
        }), 200
    
    return jsonify({'error': 'Invalid video file type'}), 400


@app.route('/static/uploads/<path:filename>')
def serve_uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    
@app.route('/send_status/<device_id>', methods=['POST'])
def send_status(device_id):
    """
    Store device status in Redis
    Expected JSON payload: {'status': 'completed|failed|in progress'}
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        status = data.get('status')
        
        if not status:
            return jsonify({'error': 'Status field is required'}), 400
        
        valid_statuses = ['completed', 'failed', 'in progress']
        if status not in valid_statuses:
            return jsonify({
                'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'
            }), 400
        
        redis_client.set(f'{device_id}:status', status)
        
        logger.info(f"Device {device_id} status updated to: {status}")
        
        return jsonify({
            'status': 'success',
            'message': f'Device {device_id} status updated to {status}',
            'device_id': device_id,
            'device_status': status  
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating device status: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to update device status: {str(e)}'
        }), 500

@app.route('/get_status/<node_id>', methods=['GET'])
def get_status(node_id):
    try:
        status = redis_client.get(f"flow_execution:{node_id}")
        print(status)

        return jsonify({
            'node_id': node_id,
            'status': status
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Failed to get device status: {str(e)}'
        }), 500


@app.route('/tcp_server/status', methods=['GET'])
def get_server_status():
    """Get TCP server status"""
    try:
        status = redis_client.get("tcp_server:status") or "stopped"
        return jsonify({
            'status': status
        }), 200
    except Exception as e:
        logger.error(f"Error getting server status: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/tcp_server/start', methods=['POST'])
def start_tcp_server():
    """Start TCP server"""
    try:
        redis_client.set("tcp_server:status", "running")
        logger.info("TCP server start command issued")
        return jsonify({
            'status': 'success',
            'message': 'TCP server started'
        }), 200
    except Exception as e:
        logger.error(f"Error starting server: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/tcp_server/stop', methods=['POST'])
def stop_tcp_server():
    """Stop TCP server"""
    try:
        redis_client.set("tcp_server:status", "stopped")
        logger.info("TCP server stop command issued")
        return jsonify({
            'status': 'success',
            'message': 'TCP server stopped'
        }), 200
    except Exception as e:
        logger.error(f"Error stopping server: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/devices/disconnect/<device_id>', methods=['POST'])
def disconnect_device(device_id):
    """Disconnect a specific device by setting disconnect flag in Redis"""
    try:
        # Set disconnect flag - TCP server will close socket and cleanup
        redis_client.set(f"{device_id}:disconnect", "true")
        redis_client.expire(f"{device_id}:disconnect", 10)  # Auto-expire after 10 seconds
        logger.info(f"Disconnect command issued for device: {device_id}")
        return jsonify({
            'status': 'success',
            'message': f'Device {device_id} disconnect initiated'
        }), 200
    except Exception as e:
        logger.error(f"Error disconnecting device: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/devices/disconnect_all', methods=['POST'])
def disconnect_all_devices():
    """Disconnect all connected devices by setting disconnect flags"""
    try:
        connected_devices_str = redis_client.get("connected_devices")
        if connected_devices_str:
            connected_devices = json.loads(connected_devices_str)
            disconnected_count = 0
            for device_id in connected_devices.keys():
                redis_client.set(f"{device_id}:disconnect", "true")
                redis_client.expire(f"{device_id}:disconnect", 10)
                disconnected_count += 1
            
            logger.info(f"Disconnect command issued for all {disconnected_count} devices")
            return jsonify({
                'status': 'success',
                'message': f'{disconnected_count} devices disconnect initiated'
            }), 200
        else:
            return jsonify({
                'status': 'success',
                'message': 'No devices connected'
            }), 200
    except Exception as e:
        logger.error(f"Error disconnecting all devices: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


# ============================================================
# PHYSICAL DEVICE ENDPOINTS (Monitor Devices)
# ============================================================

def send_physical_device_command(device_id, command_data, timeout=30):
    """
    Send command to physical device via Redis and wait for response
    """
    import time
    
    # Check if device is connected
    devices_json = redis_client.get("connected_physical_devices")
    if not devices_json:
        logger.error(f"No devices in connected_physical_devices Redis key")
        return False, "No physical devices connected", None
        
    devices = json.loads(devices_json)
    logger.info(f"[DEBUG] Connected physical devices in Redis: {list(devices.keys())}")
    
    if device_id not in devices:
        logger.error(f"Device {device_id} not found in connected devices: {list(devices.keys())}")
        return False, f"Physical device {device_id} not connected", None
    
    logger.info(f"[DEBUG] Device {device_id} IS connected, sending command: {command_data.get('action')}")
    
    # Send command via Redis
    command_key = f"{device_id}:physical_command"
    response_key = f"{device_id}:physical_response"
    
    logger.info(f"[DEBUG] Setting Redis key: {command_key}")
    logger.info(f"[DEBUG] Command data: {json.dumps(command_data)}")
    
    # Clear any old response
    redis_client.delete(response_key)
    
    # Send command
    redis_client.set(command_key, json.dumps(command_data))
    logger.info(f"[DEBUG] Command set to Redis key: {command_key}, waiting for response on {response_key}")
    
    # Wait for response (poll Redis)
    start_time = time.time()
    poll_count = 0
    while time.time() - start_time < timeout:
        response_json = redis_client.get(response_key)
        if response_json:
            elapsed = time.time() - start_time
            logger.info(f"[DEBUG] Response received after {elapsed:.2f}s and {poll_count} polls: {response_json}")
            redis_client.delete(response_key)  # Clean up
            
            try:
                response = json.loads(response_json)
                
                if response.get("status") == "success":
                    logger.info(f"[DEBUG] Command successful: {response.get('message', 'Success')}")
                    return True, response.get("message", "Success"), response.get("data")
                else:
                    logger.warning(f"[DEBUG] Command failed: {response.get('message', 'Failed')}")
                    return False, response.get("message", "Failed"), response.get("data")
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse response JSON: {response_json[:100]}")
                return False, f"Invalid JSON response: {str(e)}", None
        
        poll_count += 1
        time.sleep(0.1)  # Poll every 100ms
    
    # Timeout - clean up command
    redis_client.delete(command_key)
    logger.error(f"[DEBUG] Command timeout after {timeout}s ({poll_count} polls, no response on {response_key})")
    return False, f"Command timeout ({timeout}s)", None


@app.route('/api/physical-devices', methods=['GET'])
def get_physical_devices():
    """Get all connected physical devices with full data (metrics + services)"""
    try:
        devices_json = redis_client.get("connected_physical_devices")
        if not devices_json:
            logger.info("No physical devices connected")
            return jsonify({}), 200
        
        devices = json.loads(devices_json)
        logger.info(f"Found {len(devices)} physical device(s): {list(devices.keys())}")
        
        # For each device, read cached metrics and services from Redis
        for device_id in devices.keys():
            logger.info(f"Reading cached data for device: {device_id}")
            
            try:
                # Try to get cached metrics from Redis (pushed by monitor device)
                metrics_key = f"{device_id}:cached_metrics"
                metrics_json = redis_client.get(metrics_key)
                
                if metrics_json:
                    devices[device_id]['metrics'] = json.loads(metrics_json)
                    logger.info(f"✓ Cached metrics found for {device_id}")
                else:
                    # Fallback: query on-demand (old behavior)
                    logger.warning(f"No cached metrics for {device_id}, querying on-demand...")
                    metrics_command = {"action": "get_metrics", "params": {}}
                    metrics_success, metrics_msg, metrics_data = send_physical_device_command(
                        device_id, metrics_command, timeout=10
                    )
                    devices[device_id]['metrics'] = metrics_data if metrics_success else None
                    if not metrics_success:
                        devices[device_id]['metrics_error'] = metrics_msg
                
                # Try to get cached device list from Redis (pushed by monitor device)
                devices_key = f"{device_id}:cached_devices"
                devices_json = redis_client.get(devices_key)
                
                if devices_json:
                    devices[device_id]['services'] = json.loads(devices_json)
                    logger.info(f"✓ Cached services found for {device_id}: {len(devices[device_id]['services'])} service(s)")
                else:
                    # Fallback: query on-demand (old behavior)
                    logger.warning(f"No cached services for {device_id}, querying on-demand...")
                    services_command = {"action": "list_devices", "params": {}}
                    services_success, services_msg, services_data = send_physical_device_command(
                        device_id, services_command, timeout=10
                    )
                    devices[device_id]['services'] = services_data if services_success else []
                    if not services_success:
                        devices[device_id]['services_error'] = services_msg
                
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error for {device_id}: {str(e)}")
                devices[device_id]['metrics'] = None
                devices[device_id]['services'] = []
                devices[device_id]['error'] = f"JSON decode error: {str(e)}"
            except Exception as e:
                logger.error(f"Error fetching data for {device_id}: {str(e)}", exc_info=True)
                devices[device_id]['metrics'] = None
                devices[device_id]['services'] = []
                devices[device_id]['error'] = str(e)
        
        logger.info(f"Returning data for {len(devices)} device(s)")
        return jsonify(devices), 200
        
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing connected_physical_devices from Redis: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Invalid device data in Redis'}), 500
    except Exception as e:
        logger.error(f"Error getting physical devices: {str(e)}", exc_info=True)
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/physical-devices/<device_id>/metrics', methods=['GET'])
def get_physical_device_metrics(device_id):
    """Get system metrics from a physical device (reads from cached Redis data)"""
    try:
        # Try to get cached metrics from Redis first
        metrics_key = f"{device_id}:cached_metrics"
        metrics_json = redis_client.get(metrics_key)
        
        if metrics_json:
            data = json.loads(metrics_json)
            return jsonify({"status": "success", "data": data, "source": "cached"}), 200
        
        # Fallback to on-demand query if cache not available
        logger.warning(f"No cached metrics for {device_id}, querying on-demand...")
        command = {"action": "get_metrics", "params": {}}
        success, message, data = send_physical_device_command(device_id, command, timeout=10)
        
        if success:
            return jsonify({"status": "success", "data": data, "source": "on-demand"}), 200
        else:
            return jsonify({"status": "error", "message": message}), 500
    except Exception as e:
        logger.error(f"Error getting metrics: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/physical-devices/<device_id>/client-devices', methods=['GET'])
def get_client_devices_on_pi(device_id):
    """Get list of client device services running on this Pi (reads from cached Redis data)"""
    try:
        # Try to get cached device list from Redis first
        devices_key = f"{device_id}:cached_devices"
        devices_json = redis_client.get(devices_key)
        
        if devices_json:
            data = json.loads(devices_json)
            return jsonify({"status": "success", "devices": data, "source": "cached"}), 200
        
        # Fallback to on-demand query if cache not available
        logger.warning(f"No cached devices for {device_id}, querying on-demand...")
        command = {"action": "list_devices", "params": {}}
        success, message, data = send_physical_device_command(device_id, command, timeout=10)
        
        if success:
            return jsonify({"status": "success", "devices": data, "source": "on-demand"}), 200
        else:
            return jsonify({"status": "error", "message": message}), 500
    except Exception as e:
        logger.error(f"Error listing client devices: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
        
        if success:
            return jsonify({"status": "success", "devices": data}), 200
        else:
            return jsonify({"status": "error", "message": message}), 500
    except Exception as e:
        logger.error(f"Error listing client devices: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/physical-devices/<device_id>/restart-pi', methods=['POST'])
def restart_raspberry_pi(device_id):
    """Restart the entire Raspberry Pi"""
    try:
        logger.info(f"[DEBUG] restart_raspberry_pi called with device_id: {device_id}")
        
        data = request.get_json()
        confirm = data.get('confirm', False)
        logger.info(f"[DEBUG] Request data: {data}")
        
        if not confirm:
            logger.warning(f"[DEBUG] Restart not confirmed for {device_id}")
            return jsonify({"status": "error", "message": "confirm: true required"}), 400
        
        command = {
            "action": "restart_pi", 
            "params": {"confirm": True}
        }
        logger.info(f"[DEBUG] Sending command to device {device_id}: {command}")
        
        success, message, _ = send_physical_device_command(device_id, command)
        
        logger.info(f"[DEBUG] Command result - success: {success}, message: {message}")
        return jsonify({"status": "success" if success else "error", "message": message}), 200 if success else 500
    except Exception as e:
        logger.error(f"Error restarting Pi: {str(e)}", exc_info=True)
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/physical-devices/<device_id>/service/<action>', methods=['POST'])
def control_client_service(device_id, action):
    """Control a client service: restart, stop, start"""
    try:
        data = request.get_json()
        service_name = data.get('service_name')
        
        if not service_name:
            return jsonify({"status": "error", "message": "service_name required"}), 400
        
        # Map action to command
        if action == "restart":
            command = {
                "action": "restart_device", 
                "params": {"device_service": service_name}
            }
        elif action == "stop":
            command = {
                "action": "stop_device", 
                "params": {"device_service": service_name}
            }
        elif action == "start":
            command = {
                "action": "start_device", 
                "params": {"device_service": service_name}
            }
        else:
            return jsonify({"status": "error", "message": "Invalid action"}), 400
        
        success, message, _ = send_physical_device_command(device_id, command)
        
        return jsonify({"status": "success" if success else "error", "message": message}), 200 if success else 500
    except Exception as e:
        logger.error(f"Error controlling service: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)