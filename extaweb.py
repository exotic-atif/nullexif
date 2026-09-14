import subprocess
import json
import sys
import os
import re
from PIL import Image

def normalize_exif_datetime(dt):
    if not dt:
        return None
    text = str(dt).strip()
    m = re.match(r'^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?', text)
    if not m:
        return None
    sec = m.group(6) if m.group(6) else "00"
    return f"{m.group(1)}:{m.group(2)}:{m.group(3)} {m.group(4)}:{m.group(5)}:{sec}"


def get_metadata(image_path):
    """Extracts metadata from an image using ExifTool and returns it as a dictionary."""
    if not os.path.exists(image_path):
        return {"error": "File not found"}
    
    try:
        # -fast flag avoids reading full image payload / preview images
        # -j flag returns output in JSON format
        # -G flag includes group names (e.g. EXIF, XMP, IPTC)
        result = subprocess.run(
            ["exiftool", "-fast", "-j", "-G", image_path],
            capture_output=True,
            text=True,
            check=True
        )
        data = json.loads(result.stdout)[0]
        google_coords = format_google_maps_coordinates(data)
        if google_coords:
            data["EXIF:GoogleMapsCoordinates"] = google_coords
        return data
    except Exception as e:
        return {"error": str(e)}

def normalize_gps_ref(ref):
    text = str(ref or "").strip().upper()
    if text.startswith("N"):
        return "N"
    if text.startswith("S"):
        return "S"
    if text.startswith("E"):
        return "E"
    if text.startswith("W"):
        return "W"
    return ""

def normalize_dms_text(value):
    text = str(value or "").strip()
    text = text.replace(" deg ", "°")
    text = re.sub(r'\b(N|S|E|W|North|South|East|West)\b', '', text, flags=re.IGNORECASE)
    return re.sub(r'\s+', '', text)

def format_gps_component(dms_value, ref):
    deg, minutes, seconds = str(dms_value).split()
    return f"{deg}°{minutes}'{seconds}\"{ref}"

def format_google_maps_coordinates(metadata):
    lat = metadata.get("EXIF:GPSLatitude") or metadata.get("Composite:GPSLatitude")
    lon = metadata.get("EXIF:GPSLongitude") or metadata.get("Composite:GPSLongitude")
    if not lat or not lon:
        gps_position = metadata.get("Composite:GPSPosition")
        if gps_position:
            parsed = parse_coordinates(str(gps_position))
            if parsed:
                return (
                    f"{format_gps_component(parsed['GPSLatitude'], parsed['GPSLatitudeRef'])} "
                    f"{format_gps_component(parsed['GPSLongitude'], parsed['GPSLongitudeRef'])}"
                )
        return None

    lat_ref = normalize_gps_ref(metadata.get("EXIF:GPSLatitudeRef") or metadata.get("XMP:GPSLatitudeRef"))
    lon_ref = normalize_gps_ref(metadata.get("EXIF:GPSLongitudeRef") or metadata.get("XMP:GPSLongitudeRef"))

    if not lat_ref:
        lat_match = re.search(r'\b([NS]|North|South)\b', str(lat), re.IGNORECASE)
        lat_ref = normalize_gps_ref(lat_match.group(1) if lat_match else "")
    if not lon_ref:
        lon_match = re.search(r'\b([EW]|East|West)\b', str(lon), re.IGNORECASE)
        lon_ref = normalize_gps_ref(lon_match.group(1) if lon_match else "")

    if lat_ref and lon_ref:
        return f"{normalize_dms_text(lat)}{lat_ref} {normalize_dms_text(lon)}{lon_ref}"
    return None

def parse_coordinates(coord_str):
    if not coord_str:
        return None

    coord_str = str(coord_str)
    # Decimal format: 22.9000, 88.0897
    decimal_pattern = r'^\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*$'

    dms_text = coord_str.replace(" deg ", "°").replace(",", " ")
    # DMS format: 22°54'00.0"N 88°05'23.0"E
    dms_pattern = r'(\d+)\s*°\s*(\d+)\'\s*([\d.]+)"?\s*(N|S|North|South)\s+(\d+)\s*°\s*(\d+)\'\s*([\d.]+)"?\s*(E|W|East|West)'

    dms_match = re.search(dms_pattern, dms_text, re.IGNORECASE)
    if dms_match:
        lat_deg, lat_min, lat_sec, lat_ref = dms_match.group(1), dms_match.group(2), dms_match.group(3), normalize_gps_ref(dms_match.group(4))
        lon_deg, lon_min, lon_sec, lon_ref = dms_match.group(5), dms_match.group(6), dms_match.group(7), normalize_gps_ref(dms_match.group(8))
        
        return {
            "GPSLatitude": f"{lat_deg} {lat_min} {lat_sec}",
            "GPSLatitudeRef": lat_ref,
            "GPSLongitude": f"{lon_deg} {lon_min} {lon_sec}",
            "GPSLongitudeRef": lon_ref
        }
    
    decimal_match = re.search(decimal_pattern, coord_str)
    if decimal_match:
        try:
            lat_raw = float(decimal_match.group(1))
            lon_raw = float(decimal_match.group(2))
            
            def to_dms(val):
                abs_val = abs(val)
                total_seconds = round(abs_val * 3600, 4)
                deg = int(total_seconds // 3600)
                minutes = int((total_seconds % 3600) // 60)
                seconds = round(total_seconds % 60, 4)
                return deg, minutes, seconds

            lat_deg, lat_min, lat_sec = to_dms(lat_raw)
            lat_ref = "N" if lat_raw >= 0 else "S"
            
            lon_deg, lon_min, lon_sec = to_dms(lon_raw)
            lon_ref = "E" if lon_raw >= 0 else "W"
            
            return {
                "GPSLatitude": f"{lat_deg} {lat_min} {lat_sec}",
                "GPSLatitudeRef": lat_ref,
                "GPSLongitude": f"{lon_deg} {lon_min} {lon_sec}",
                "GPSLongitudeRef": lon_ref
            }
        except Exception:
            return None
    
    return None


def apply_metadata(target_image, metadata_json, output_image=None, convert_to=None):
    """Applies metadata from a JSON dictionary to the target image."""
    if not os.path.exists(target_image):
        return {"error": "Target image not found"}
    
    if output_image is None:
        output_image = "output_" + os.path.basename(target_image)
    
    current_image = target_image
    
    # Handle conversion
    if convert_to:
        name, ext = os.path.splitext(target_image)
        new_name = name + "_converted." + convert_to.lower()
        try:
            with Image.open(target_image) as img:
                # Convert RGBA to RGB if saving as JPG
                if convert_to.lower() in ["jpg", "jpeg"] and img.mode == "RGBA":
                    img = img.convert("RGB")
                img.save(new_name)
            current_image = new_name
            # If we converted, the output should probably match the new extension
            output_image = os.path.splitext(output_image)[0] + "." + convert_to.lower()
        except Exception as e:
            return {"error": f"Conversion failed: {str(e)}"}

    # Prepare ExifTool command
    command = ["exiftool", "-overwrite_original"]
    
    # Load metadata to apply
    if isinstance(metadata_json, str):
        metadata = json.loads(metadata_json)
    else:
        metadata = metadata_json

    # Keep all major date tags in sync so cloud providers (including Google Photos)
    # can consistently infer the capture timestamp from the processed image.
    date_candidate = (
        metadata.get("EXIF:DateTimeOriginal")
        or metadata.get("DateTimeOriginal")
        or metadata.get("EXIF:CreateDate")
        or metadata.get("CreateDate")
    )
    normalized_date = normalize_exif_datetime(date_candidate)
    if normalized_date:
        metadata["EXIF:DateTimeOriginal"] = normalized_date
        metadata["EXIF:CreateDate"] = normalized_date
        metadata["EXIF:ModifyDate"] = normalized_date
        metadata["XMP:DateCreated"] = normalized_date
        metadata["XMP:CreateDate"] = normalized_date
        metadata["IPTC:DateCreated"] = normalized_date[:10].replace(":", "-")
        metadata["IPTC:TimeCreated"] = normalized_date[11:]
    
    # Handle Google Maps Coordinates
    google_coord_keys = ["GoogleMapsCoordinates", "EXIF:GoogleMapsCoordinates"]
    for key in google_coord_keys:
        if key in metadata:
            coord_val = str(metadata.pop(key)).strip()
            if coord_val:
                parsed = parse_coordinates(coord_val)
                if parsed:
                    metadata.update(parsed)
                else:
                    return {"error": "Invalid coordinate format. Expected format: 22°54'00.0\"N 88°05'23.0\"E"}
            break
    
    # We want to exclude some tags that shouldn't be manually edited or are read-only
    excluded_tags = ["SourceFile", "ExifTool:ExifToolVersion", "File:FileName", "File:Directory", "File:FileSize", "File:FileModifyDate", "File:FileAccessDate", "File:FileCreateDate", "File:FilePermissions", "File:FileType", "File:FileTypeExtension", "File:MIMEType"]
    
    for tag, value in metadata.items():
        if tag in excluded_tags:
            continue
        
        # Sanitization
        clean_value = str(value).strip()
        
        # ISO should be numeric
        if "ISO" in tag:
            clean_value = "".join(filter(str.isdigit, clean_value))
            if not clean_value: continue # Skip if empty after cleaning
        # Date formats (YYYY:MM:DD HH:MM:SS)
        if "Date" in tag or "Time" in tag:
            # Simple check for common date patterns
            if clean_value and not any(char.isdigit() for char in clean_value):
                continue # Skip invalid dates
        
        if clean_value:
            command.append(f"-{tag}={clean_value}")
    
    command.append(current_image)
    
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
        # Rename to final output image if it's different
        if current_image != output_image:
            if os.path.exists(output_image):
                os.remove(output_image)
            os.rename(current_image, output_image)
        
        return {"success": True, "output": output_image}
    except subprocess.CalledProcessError as e:
        # The image might have corrupted EXIF structure (e.g. invalid OtherImageStart data).
        # We can attempt to fix it by having exiftool rebuild the metadata safely, then retry our update.
        try:
            fix_cmd = ["exiftool", "-overwrite_original", "-all=", "-tagsfromfile", "@", "-all:all", "-unsafe", "-icc_profile", current_image]
            subprocess.run(fix_cmd, check=True, capture_output=True, text=True)
            
            # Retry original command
            subprocess.run(command, check=True, capture_output=True, text=True)
            
            # Rename to final output image if it's different
            if current_image != output_image:
                if os.path.exists(output_image):
                    os.remove(output_image)
                os.rename(current_image, output_image)
                
            return {"success": True, "output": output_image}
        except subprocess.CalledProcessError as fix_e:
            # If the retry also fails, return the original error so the user sees it cleanly (not as a byte string)
            return {"error": f"ExifTool failed: {e.stderr}"}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No action specified"}))
            sys.exit(1)
        
        action = sys.argv[1]
        
        if action == "get_meta":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "No image path provided"}))
            else:
                print(json.dumps(get_metadata(sys.argv[2])))
                
        elif action == "apply_meta":
            if len(sys.argv) < 4:
                print(json.dumps({"error": "Target image and metadata required"}))
            else:
                target = sys.argv[2]
                meta_input = sys.argv[3]
                
                # Check if input is a file path or raw JSON
                if os.path.exists(meta_input):
                    with open(meta_input, 'r', encoding='utf-8') as f:
                        meta = json.load(f)
                else:
                    meta = json.loads(meta_input)
                
                output = sys.argv[4] if len(sys.argv) > 4 else None
                convert = sys.argv[5] if len(sys.argv) > 5 else None
                print(json.dumps(apply_metadata(target, meta, output, convert)))
        else:
            print(json.dumps({"error": f"Unknown action: {action}"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
