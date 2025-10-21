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
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

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
    Send stop/cancel command to a device (queues command, device will confirm with status update)
    """
    try:
        data = request.get_json() or {}
        node_id = data.get('nodeId')
        
        logger.info(f"Sending stop command to device {device_id} (node: {node_id})")
        
        # Queue the stop command - device will process it and update status
        command_data = {
            'command': 'stop',
            'node_id': node_id
        }
        redis_client.lpush(f'{device_id}:commands', json.dumps(command_data))
        
        logger.info(f"Stop command queued for device {device_id}")
        
        return jsonify({
            'status': 'success',
            'message': f'Stop command sent to device {device_id}',
            'deviceId': device_id,
            'nodeId': node_id
        }), 200
        
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

@app.route('/stop_all', methods=['POST'])
def stop_all():
    """
    Broadcast stop command to all connected devices via Redis
    All devices will receive and process the stop command in parallel
    """
    try:
        logger.info("Broadcasting stop command to all connected devices...")
        
        connected_dev = redis_client.get("connected_devices")
        if not connected_dev:
            logger.info("No connected devices found")
            return jsonify({
                'status': 'success',
                'message': 'No devices to stop',
                'devices_stopped': 0
            }), 200
        
        devices = json.loads(connected_dev.replace("'", '"'))
        device_count = 0
        
        # Send stop command to all devices via Redis
        for device_id in devices.keys():
            command_data = {
                'command': 'stop',
                'node_id': None
            }
            redis_client.lpush(f'{device_id}:commands', json.dumps(command_data))
            device_count += 1
            logger.info(f"Stop command queued for device: {device_id}")
        
        logger.info(f"Stop command broadcasted to {device_count} devices")
        
        return jsonify({
            'status': 'success',
            'message': f'Stop command sent to {device_count} devices',
            'devices_stopped': device_count
        }), 200
        
    except Exception as e:
        logger.error(f"Error broadcasting stop to all devices: {str(e)}")
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


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)