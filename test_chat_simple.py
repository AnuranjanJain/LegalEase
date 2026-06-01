import http.client
import json

# Test the chat endpoint with a direct request
conn = http.client.HTTPConnection('localhost', 8000)

# First, signup to get a token
print("1. Signing up...")
headers = {'Content-Type': 'application/json'}
signup_body = json.dumps({
    'email': 'test_chat_verify@example.com',
    'password': 'password123'
})
conn.request('POST', '/auth/signup', signup_body, headers)
response = conn.getresponse()
signup_data = json.loads(response.read().decode())
print(f"Signup status: {response.status}")

if 'access_token' in signup_data:
    token = signup_data['access_token']
    print(f"Got token: {token[:50]}...\n")
    
    # Now test chat with this token
    print("2. Testing chat endpoint...")
    chat_headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    chat_body = json.dumps({
        'query': 'What is a contract?',
        'chat_history': []
    })
    
    conn.request('POST', '/chat', chat_body, chat_headers)
    chat_response = conn.getresponse()
    print(f"Chat status: {chat_response.status}")
    
    # Read response - might be streaming
    chat_data = chat_response.read().decode()
    print(f"Chat response (first 500 chars):\n{chat_data[:500]}")
    
    # Try to parse as JSON if possible
    try:
        parsed = json.loads(chat_data)
        print(f"\nParsed JSON:\n{json.dumps(parsed, indent=2)}")
    except:
        print(f"\nCouldn't parse as JSON, raw response shown above")
else:
    print("Signup failed, no token received")
    print(f"Response: {signup_data}")

conn.close()
