import subprocess
import sys
import os

def copy_all_metadata(source_image, target_image, output_image):
    if not os.path.exists(source_image):
        print("[!] Source image not found")
        return

    if not os.path.exists(target_image):
        print("[!] Target image not found")
        return

    # Copy ALL metadata from source to target
    command = [
        "exiftool",
        "-overwrite_original",
        "-TagsFromFile", source_image,
        "-All:All",
        "-XMP:All",
        "-IPTC:All",
        target_image
    ]

    try:
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL)
        os.rename(target_image, output_image)
        print("✅ Metadata copied successfully!")
        print(f"📸 Output image: {output_image}")
    except subprocess.CalledProcessError:
        print("[!] Failed to copy metadata. Make sure ExifTool is installed.")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage:")
        print("python meta.py source.jpg target.jpg output.jpg")
        sys.exit(1)

    source = sys.argv[1]
    target = sys.argv[2]
    output = sys.argv[3]

    copy_all_metadata(source, target, output)
