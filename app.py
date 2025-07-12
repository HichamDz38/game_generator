from flask import Flask, render_template, jsonify, request
import os
import redis
import json

redis_client = redis.Redis(host='host.docker.internal', port=6379, decode_responses=True)


app = Flask(__name__)

prop_status = {i: 'Not activated' for i in range(1, 9)}

@app.route('/')
def index():
    return render_template('index.html', prop_status=prop_status, page_title = "My Dashboard")

@app.route('/get_devices', methods=['GET'])
def get_devices():
    connected_dev = redis_client.get("connected_devices")
    return json.dumps(connected_dev)

@app.route('/reset/<device_id>', methods=['POST'])
def reset(device_id):
    redis_client.lpush(f'{device_id}:commands', "reset")
    return jsonify({'status': 'success'})

@app.route('/activate/<device_id>', methods=['POST'])
def activate(device_id):
    redis_client.lpush(f'{device_id}:commands', "activate")
    return jsonify({'status': 'success'})

@app.route('/finish/<device_id>', methods=['POST'])
def finish(device_id):
    redis_client.lpush(f'{device_id}:commands', "finish")
    return jsonify({'status': 'success'})

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


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)