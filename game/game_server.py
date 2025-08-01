import redis

redis_client = redis.Redis(host='redis', port=6379, decode_responses=True)
pubsub = redis_client.pubsub()
pubsub.subscribe('game_channel')

print("[Game] Listening for commands on 'game_channel'...")

for message in pubsub.listen():
    if message['type'] == 'message':
        command = message['data']
        print(f"[Game] Received command: {command}")
        # هنا تنفذ الكود الذي يشغل اللعبة أو يعيدها للوضع الافتراضي
