import uuid
import json
import base64
import requests
from concurrent.futures import ThreadPoolExecutor
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.core.files.storage import default_storage

# Replace with your deployed Lambda URL
LAMBDA_API_URL = 'https://wkwg5ojnse54vm2ylk6agt3ovq0jswdp.lambda-url.us-east-1.on.aws/'


def convert_to_float(value):
    """Try to convert a coordinate value to a float."""
    try:
        return float(value)
    except Exception:
        raise ValueError("Conversion failed for value: {}".format(value))


@csrf_exempt
def index(request):
    return render(request, 'index.html')


@csrf_exempt
def handle_prompt(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method allowed'}, status=405)

    prompt_id = request.POST.get('prompt_id') or str(uuid.uuid4())
    message = request.POST.get('message')
    # Get all files uploaded under the "image" key.
    images = request.FILES.getlist('image')
    image_provided = True if images else False

    # If no images are provided, process a single payload (with only message).
    if not images:
        payload = {'prompt_id': prompt_id}
        if message:
            payload['message'] = message
        try:
            response = requests.post(
                LAMBDA_API_URL,
                data=json.dumps(payload),
                headers={'Content-Type': 'application/json'}
            )
            response_data = response.json()
            print(response_data.get("response", ""))
        except Exception as e:
            return JsonResponse({'error': 'Error communicating with Lambda: {}'.format(str(e))})
        return JsonResponse(response_data)

    # Process each uploaded image concurrently.
    def process_image(image_file):
        # Save image temporarily.
        temp_path = default_storage.save(image_file.name, image_file)
        with default_storage.open(temp_path, 'rb') as f:
            encoded_image = base64.b64encode(f.read()).decode('utf-8')
        default_storage.delete(temp_path)
        # Build payload including prompt_id, message, and the encoded image.
        payload = {'prompt_id': prompt_id, 'image': encoded_image}
        if message:
            payload['message'] = message
        try:
            lambda_response = requests.post(
                LAMBDA_API_URL,
                data=json.dumps(payload),
                headers={'Content-Type': 'application/json'}
            )
            result = lambda_response.json()
        except Exception as e:
            result = {'error': f"Error processing image {image_file.name}: {str(e)}"}
        result['image_name'] = image_file.name
        return result

    with ThreadPoolExecutor() as executor:
        results = list(executor.map(process_image, images))

    # Aggregate data from all image responses.
    aggregated_valid_coordinates = []
    aggregated_invalid_coordinates = []
    aggregated_image_urls = []
    combined_response_text = ""

    for res in results:
        if res.get('error'):
            combined_response_text += (
                f"Error processing {res.get('image_name')}: {res.get('error')}"
            )
            continue

        valid_coords_raw = res.get("valid_coordinates", [])
        # Process coordinates returned as lists/tuples or dicts.
        for coord in valid_coords_raw:
            if isinstance(coord, (list, tuple)) and len(coord) >= 2:
                try:
                    lat_value = convert_to_float(coord[0])
                    lon_value = convert_to_float(coord[1])
                    aggregated_valid_coordinates.append({"lat": lat_value, "lon": lon_value})
                except Exception:
                    aggregated_invalid_coordinates.append(coord)
            elif isinstance(coord, dict):
                raw_lat = coord.get("lat") if coord.get("lat") is not None else coord.get("latitude")
                raw_lon = coord.get("lon") if coord.get("lon") is not None else coord.get("longitude")
                try:
                    lat_value = convert_to_float(raw_lat)
                    lon_value = convert_to_float(raw_lon)
                    aggregated_valid_coordinates.append({"lat": lat_value, "lon": lon_value})
                except Exception:
                    aggregated_invalid_coordinates.append(coord)
            else:
                aggregated_invalid_coordinates.append(coord)

        # Collect any additional invalid coordinates.
        more_invalid = res.get("invalid_coordinates", [])
        if more_invalid:
            aggregated_invalid_coordinates.extend(more_invalid)

        # Process image URL(s) returned from Lambda.
        if "image_urls" in res and isinstance(res["image_urls"], list):
            for url in res["image_urls"]:
                if isinstance(url, str) and url.strip():
                    aggregated_image_urls.append(url.strip())
        elif res.get("image_url", "").strip():
            aggregated_image_urls.append(res.get("image_url").strip())

        # Concatenate Lambda's text response.

        combined_response_text += res.get("response", "")


    # If images were provided but no valid coordinates, add an extra message.
    if image_provided and not aggregated_valid_coordinates:
        combined_response_text += "No valid coordinates found."

    # Build a table for invalid coordinates if available.
    if aggregated_invalid_coordinates:
        table_html = """
        <br/>
        <table border="1" style="border-collapse: collapse; color: white; font-size: 0.9rem;">
            <tr style="background-color: #2c2d3a;"><th>Latitude</th><th>Longitude</th></tr>
        """

        for ic in aggregated_invalid_coordinates:
            print(ic)
            print(ic.get("latitude", ""))
            print(ic.get("longitude", ""))
            if isinstance(ic, dict):
                lat_val = ic.get("lat") if ic.get("lat") is not None else ic.get('input', {}).get("latitude", "")
                lon_val = ic.get("lon") if ic.get("lon") is not None else ic.get('input', {}).get("longitude", "")
            elif isinstance(ic, (list, tuple)):
                lat_val = ic[0] if len(ic) > 0 else ""
                lon_val = ic[1] if len(ic) > 1 else ""
            else:
                lat_val, lon_val = "", ""
            table_html += (
                f"<tr><td style='padding: 4px;'>{lat_val}</td>"
                f"<td style='padding: 4px;'>{lon_val}</td></tr>"
            )
        table_html += "</table>"
        combined_response_text += "Invalid coordinates:" + table_html
    print(combined_response_text)

    return JsonResponse({
        "response": combined_response_text,
        "coordinates": aggregated_valid_coordinates,
        "image_urls": aggregated_image_urls
    })
