import requests

def main_screen():
    # Webhook URL
    print("Main Screen")
    url = "https://wholesomegoods.app.n8n.cloud/webhook/0faaa164-ecb5-4afd-a3d6-2b3766278768"
    local_url = "http://localhost:8000/v1/main_screen"
    data = {
        "productUrl": "https://patternwellness.com/products/cholesterol-complex?_atid=74TORiBVb6dksiPrMZ6Q2ibrBnzMyA",
        "winningAngle": "Best value for money",
        "targetAudience": "Young adults, 18-25",
        "brandTone": "Friendly and energetic",
        "offerDetails": "Buy one get one free",
        "productTypes": "Gadgets, Accessories"
    }
    try:
        # Send POST request
        response = requests.post(url, json=data)
        
        # Print response
        print("Status Code:", response.status_code)
        print("Response : ", response)
        print("Response Body:", response.text)
    except requests.exceptions.RequestException as e:
        print("Error:", e)

def screen2():
    # Webhook URL
    print("Screen 2")
    url = "https://wholesomegoods.app.n8n.cloud/webhook/ab94aeee-3fc4-4d47-be04-a20b701fafd8"
    local_url = "http://localhost:8000/v1/screen2"

    # Replace these with the actual values you want to send
    data = {
        "productUrl": "https://patternwellness.com/products/cholesterol-complex?_atid=74TORiBVb6dksiPrMZ6Q2ibrBnzMyA",
        "winningAngle": "heart blocked",
        "ctaHook":"What if you could support your heart health naturally today?",
    }

    try:
        # Send POST request
        response = requests.post(local_url, json=data)
        
        # Print response
        print("Status Code:", response.status_code)
        print("Response : ", response)
        print("Response Body:", response.text)
    except requests.exceptions.RequestException as e:
        print("Error:", e)

def screen3():
    # Webhook URL
    print("Screen 3")
    url = "https://wholesomegoods.app.n8n.cloud/webhook/ab94aeee-3fc4-4d47-be04-a20b701fafd8"
    local_url = "http://localhost:8000/v1/screen3"

    # Replace these with the actual values you want to send
    data = {
        "productUrl": "https://patternwellness.com/products/cholesterol-complex?_atid=74TORiBVb6dksiPrMZ6Q2ibrBnzMyA",
        "winningAngle": "heart blocked",
        "ctaHook":"What if you could support your heart health naturally today?",
    }

    try:
        # Send POST request
        response = requests.post(local_url, json=data)
        
        # Print response
        print("Status Code:", response.status_code)
        print("Response : ", response)
        print("Response Body:", response.text)
    except requests.exceptions.RequestException as e:
        print("Error:", e)

def screen4():
    # Webhook URL
    print("Screen 4")
    url = "https://wholesomegoods.app.n8n.cloud/webhook/60ce0ddc-7e2e-42ef-b5f0-ac2511363667"
    local_url = "http://localhost:8000/v1/screen4"

    # Replace these with the actual values you want to send
    data = {
        "aidaScript": "1. Three red flags of high cholesterol that doctors won't tell you.\r\n2. Random heart palpitations during simple tasks like climbing stairs.\r",
        "imgUrl": "https://wgimag.es/ai/93a06-auto-HighqualityphotorealisticsceneAwidedista-gpt-image-1.png, https://wgimag.es/ai/d8a55-auto-HighqualityphotorealisticAdistantvertica-gpt-image-1.png",
    }

    try:
        # Send POST request
        response = requests.post(url, json=data, timeout=1200) #20 min
        
        # Print response
        print("Status Code:", response.status_code)
        print("Response : ", response)
        print("Response Body:", response.text)
    except requests.exceptions.RequestException as e:
        print("Error:", e)

if __name__ == "__main__":
    # main_screen()
    # screen2()
    # screen3()
    screen4()