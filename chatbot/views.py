import uuid
import base64
import json
import requests

from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.core.files.storage import default_storage

from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout as auth_logout
from django.http import HttpResponse


# Replace with your actual Lambda URL
LAMBDA_API_URL = 'https://wkwg5ojnse54vm2ylk6agt3ovq0jswdp.lambda-url.us-east-1.on.aws/'




@login_required(login_url='/login/')
def index(request):
    return render(request, 'chatbot/index.html')


# Redirect `/` based on login status
def redirect_to_chat(request):
    return redirect('index') if request.user.is_authenticated else redirect('login')



def redirect_to_chat(request):
    if request.user.is_authenticated:
        return redirect('index')
    else:
        return redirect('login')


# Login view
@csrf_exempt
def login_view(request):
    if request.user.is_authenticated:
        return redirect('index')  # Already logged in

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect('index')
        else:
            return render(request, 'chatbot/login.html', {'error': 'Invalid credentials'})

    return render(request, 'chatbot/login.html')

# Logout view


@csrf_exempt
def logout_view(request):
    auth_logout(request)
    return HttpResponse('<h3>You have been logged out. Redirecting to login...</h3><script>setTimeout(function(){ window.location.href = "/login/"; }, 2000);</script>')




# Process user message & optional image
@csrf_exempt
@login_required
def handle_prompt(request):
    if request.method == 'POST':
        prompt_id = request.POST.get('prompt_id') or str(uuid.uuid4())
        message = request.POST.get('message')
        image = request.FILES.get('image')
        payload = {'prompt_id': prompt_id}

        if message:
            payload['message'] = message

        if image:
            temp_path = default_storage.save(image.name, image)
            with default_storage.open(temp_path, 'rb') as f:
                payload['image'] = base64.b64encode(f.read()).decode('utf-8')
            default_storage.delete(temp_path)

        try:
            response = requests.post(
                LAMBDA_API_URL,
                data=json.dumps(payload),
                headers={'Content-Type': 'application/json'}
            )
            response_data = response.json()
        except Exception as e:
            return JsonResponse({'error': 'Invalid JSON from Lambda', 'raw': str(e)})

        # Extract coordinates
        coordinates = []
        for coord in response_data.get("valid_coordinates", []):
            if isinstance(coord, (list, tuple)) and len(coord) >= 2:
                coordinates.append({"lat": coord[0], "lon": coord[1]})
            elif isinstance(coord, dict):
                lat = coord.get("latitude")
                lon = coord.get("longitude")
                if lat and lon:
                    coordinates.append({"lat": lat, "lon": lon})

        return JsonResponse({
            "response": response_data.get("response", ""),
            "coordinates": coordinates,
            "image_url": response_data.get("image_url", ""),
            "prompt_id": prompt_id,
            "status": response.status_code,
            "error": response_data.get("error", ""),
            "raw": response_data.get("raw", ""),
        })

    return JsonResponse({'error': 'Only POST method allowed'}, status=405)
