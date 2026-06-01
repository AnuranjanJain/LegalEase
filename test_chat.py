import http.client
import json

def make_request(method, endpoint, body=None, token=None):
    conn = http.client.HTTPConnection('localhost', 8000)
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    if body:
        body_str = json.dumps(body)
        conn.request(method, endpoint, body_str, headers)
    else:
        conn.request(method, endpoint, headers=headers)
    
    response = conn.getresponse()
    status = response.status
    try:
        data = json.loads(response.read().decode())
    except:
        data = response.read().decode()
    conn.close()
    return status, data

# Test signup to create a user
print("1. Testing signup...")
status, data = make_request('POST', '/auth/signup', {
    'email': 'test_chat_ai@example.com',
    'password': 'password123'
})
print(f"Status: {status}")
print(f"Response: {json.dumps(data, indent=2) if isinstance(data, dict) else data}\n")

# Try login
print("2. Testing login...")
status, data = make_request('POST', '/auth/login', {
    'email': 'test_chat_ai@example.com',
    'password': 'password123'
})
print(f"Status: {status}")
print(f"Response: {json.dumps(data, indent=2) if isinstance(data, dict) else data}\n")

if status == 200 and isinstance(data, dict) and 'access_token' in data:
    token = data['access_token']
    print(f"Got token: {token[:50]}...\n")
    
    # Test chat endpoint with JWT token
    print("3. Testing chat endpoint with JWT token...")
    status, response_data = make_request('POST', '/chat', {
        'query': 'What is the definition of a contract?',
        'chat_history': []
    }, token=token)
    
    print(f"Status: {status}")
    if isinstance(response_data, dict):
        print(f"Response: {json.dumps(response_data, indent=2)}")
    else:
        print(f"Response (string): {str(response_data)[:1000]}")
else:
    print("Failed to get token, cannot test chat")
