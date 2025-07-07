from flask import Flask, render_template, jsonify, request
import os

app = Flask(__name__)

prop_status = {i: 'Not activated' for i in range(1, 9)}

@app.route('/')
def index():
    props = [
        {'id': 1, 'name': 'Table0', 'hints': ['Hint 1', 'Hint 2']},
        {'id': 2, 'name': 'Table1', 'hints': ['Hint 1', 'Hint 2', 'Hint 3', 'Hint 4', 'Hint 5', 'Hint 6']},
        {'id': 3, 'name': 'Table2', 'hints': ['Hint 1']},
        {'id': 4, 'name': 'Table3', 'hints': []}, 
        {'id': 5, 'name': 'Framework', 'hints': ['Hint 1']},
        {'id': 6, 'name': 'Footprints', 'hints': []},
        {'id': 7, 'name': 'Elephant', 'hints': ['Hint 1', 'Hint 2']},
        {'id': 8, 'name': 'Clock', 'hints': ['Hint 1']}
    ]
    return render_template('index.html', props=props, prop_status=prop_status, page_title = "My Dashboard")


@app.route('/reset/<int:prop_id>', methods=['POST'])
def reset(prop_id):
    prop_status[prop_id] = 'Reset'
    return jsonify({'status': 'NOT Activated', 'prop_id': prop_id})

@app.route('/activate/<int:prop_id>', methods=['POST'])
def activate(prop_id):
    prop_status[prop_id] = 'Activated'
    return jsonify({'status': 'Activated', 'prop_id': prop_id})

@app.route('/finish/<int:prop_id>', methods=['POST'])
def finish(prop_id):
    prop_status[prop_id] = 'Finished'
    return jsonify({'status': 'Finished', 'prop_id': prop_id})

@app.route('/hint/<int:prop_id>', methods=['POST'])
def hint(prop_id):
    hint_name = request.json.get('hint')
    print(f"Hint '{hint_name}' triggered for prop {prop_id}")
    return jsonify({'hint': f"{hint_name} triggered", 'prop_id': prop_id})


@app.route('/start_all', methods=['POST'])
def start_all():
    for key in prop_status.keys():
        prop_status[key] = 'Activated'
    return jsonify({'status': 'Activated', 'updated': prop_status})

@app.route('/reset_all', methods=['POST'])
def reset_all():
    for key in prop_status.keys():
        prop_status[key] = 'NOT Activated'
    return jsonify({'status': 'NOT Activated', 'updated': prop_status})

if __name__ == '__main__':
    # Get port from environment variable or default to 5000
    port = int(os.environ.get('PORT', 5000))
    # Set host to 0.0.0.0 for Docker compatibility
    app.run(host='0.0.0.0', port=port, debug=False)