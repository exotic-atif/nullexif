<?php
/**
 * NullExif High-Performance Native ExifTool & GD Engine
 * Replaces Python runtime completely for 5-10x faster execution without process startup penalties.
 */

function normalize_exif_datetime_php($dt) {
    if (!$dt) return null;
    $text = trim((string)$dt);
    if (preg_match('/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/', $text, $m)) {
        $sec = !empty($m[6]) ? $m[6] : "00";
        return "{$m[1]}:{$m[2]}:{$m[3]} {$m[4]}:{$m[5]}:{$sec}";
    }
    return null;
}

function normalize_gps_ref_php($ref) {
    $text = strtoupper(trim((string)$ref));
    if (str_starts_with($text, 'N')) return 'N';
    if (str_starts_with($text, 'S')) return 'S';
    if (str_starts_with($text, 'E')) return 'E';
    if (str_starts_with($text, 'W')) return 'W';
    return '';
}

function normalize_dms_php($val) {
    $text = trim((string)$val);
    $text = str_replace(' deg ', '°', $text);
    $text = preg_replace('/\b(N|S|E|W|North|South|East|West)\b/i', '', $text);
    return preg_replace('/\s+/', '', $text);
}

function parse_coordinates_php($coord_str) {
    if (!$coord_str) return null;
    $raw = trim((string)$coord_str);

    // Decimal degrees format: e.g. 22.9000, 88.0897
    if (preg_match('/^\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*$/', $raw, $m)) {
        $lat_raw = (float)$m[1];
        $lon_raw = (float)$m[2];

        $to_dms = function($val) {
            $abs = abs($val);
            $total_sec = round($abs * 3600, 4);
            $deg = (int)floor($total_sec / 3600);
            $min = (int)floor(($total_sec % 3600) / 60);
            $sec = round(fmod($total_sec, 60), 4);
            return "{$deg} {$min} {$sec}";
        };

        return [
            'EXIF:GPSLatitude' => $to_dms($lat_raw),
            'EXIF:GPSLatitudeRef' => $lat_raw >= 0 ? 'N' : 'S',
            'EXIF:GPSLongitude' => $to_dms($lon_raw),
            'EXIF:GPSLongitudeRef' => $lon_raw >= 0 ? 'E' : 'W'
        ];
    }

    // DMS format: 22°54'00.0"N 88°05'23.0"E
    $dms_text = str_replace([' deg ', ','], ['°', ' '], $raw);
    $dms_pattern = '/(\d+)\s*°\s*(\d+)\'\s*([\d.]+)"?\s*(N|S|North|South)\s+(\d+)\s*°\s*(\d+)\'\s*([\d.]+)"?\s*(E|W|East|West)/i';
    if (preg_match($dms_pattern, $dms_text, $m)) {
        return [
            'EXIF:GPSLatitude' => "{$m[1]} {$m[2]} {$m[3]}",
            'EXIF:GPSLatitudeRef' => normalize_gps_ref_php($m[4]),
            'EXIF:GPSLongitude' => "{$m[5]} {$m[6]} {$m[7]}",
            'EXIF:GPSLongitudeRef' => normalize_gps_ref_php($m[8])
        ];
    }

    return null;
}

function format_google_maps_coordinates_php($meta) {
    if (empty($meta) || !is_array($meta)) return null;

    $lat = $meta['EXIF:GPSLatitude'] ?? $meta['Composite:GPSLatitude'] ?? null;
    $lon = $meta['EXIF:GPSLongitude'] ?? $meta['Composite:GPSLongitude'] ?? null;
    if (!$lat || !$lon) {
        return null;
    }

    $lat_ref = normalize_gps_ref_php($meta['EXIF:GPSLatitudeRef'] ?? $meta['XMP:GPSLatitudeRef'] ?? $lat);
    $lon_ref = normalize_gps_ref_php($meta['EXIF:GPSLongitudeRef'] ?? $meta['XMP:GPSLongitudeRef'] ?? $lon);

    if ($lat_ref && $lon_ref) {
        return normalize_dms_php($lat) . $lat_ref . ' ' . normalize_dms_php($lon) . $lon_ref;
    }
    return null;
}

function get_metadata_direct($image_path) {
    if (!file_exists($image_path)) {
        return ['error' => 'File not found'];
    }

    $cmd = 'exiftool -fast -j -G ' . escapeshellarg($image_path);
    $output = shell_exec($cmd);
    if (!$output) {
        return ['error' => 'ExifTool returned empty output'];
    }

    $decoded = json_decode($output, true);
    if (empty($decoded) || !is_array($decoded)) {
        return ['error' => 'Invalid ExifTool JSON output'];
    }

    $data = $decoded[0];
    $coords = format_google_maps_coordinates_php($data);
    if ($coords) {
        $data['EXIF:GoogleMapsCoordinates'] = $coords;
    }

    return $data;
}

function convert_image_native($src_path, $dest_path, $target_format) {
    $info = @getimagesize($src_path);
    if (!$info) return false;

    $mime = $info['mime'] ?? '';
    $img = null;

    switch ($mime) {
        case 'image/jpeg':
            $img = @imagecreatefromjpeg($src_path);
            break;
        case 'image/png':
            $img = @imagecreatefrompng($src_path);
            break;
        case 'image/webp':
            $img = @imagecreatefromwebp($src_path);
            break;
        default:
            return false;
    }

    if (!$img) return false;

    $target_format = strtolower($target_format);
    $success = false;

    if ($target_format === 'jpg' || $target_format === 'jpeg') {
        $w = imagesx($img);
        $h = imagesy($img);
        $bg = imagecreatetruecolor($w, $h);
        $white = imagecolorallocate($bg, 255, 255, 255);
        imagefilledrectangle($bg, 0, 0, $w, $h, $white);
        imagecopy($bg, $img, 0, 0, 0, 0, $w, $h);
        imagedestroy($img);
        $img = $bg;
        $success = @imagejpeg($img, $dest_path, 100);
    } elseif ($target_format === 'png') {
        imagealphablending($img, false);
        imagesavealpha($img, true);
        $success = @imagepng($img, $dest_path, 0);
    } elseif ($target_format === 'webp') {
        $success = @imagewebp($img, $dest_path, 100);
    }

    if ($img) imagedestroy($img);
    return $success;
}

function apply_metadata_direct($target_image, $metadata, $output_image = null, $convert_to = null) {
    if (!file_exists($target_image)) {
        return ['error' => 'Target image not found'];
    }

    if ($output_image === null) {
        $output_image = dirname($target_image) . '/output_' . basename($target_image);
    }

    $current_image = $target_image;

    // Handle format conversion natively with GD
    if ($convert_to) {
        $pathinfo = pathinfo($target_image);
        $converted_path = $pathinfo['dirname'] . '/' . $pathinfo['filename'] . '_converted.' . strtolower($convert_to);
        $converted = convert_image_native($target_image, $converted_path, $convert_to);
        if (!$converted) {
            return ['error' => 'Native format conversion failed'];
        }
        $current_image = $converted_path;
        $output_info = pathinfo($output_image);
        $output_image = $output_info['dirname'] . '/' . $output_info['filename'] . '.' . strtolower($convert_to);
    } else {
        // Copy to output image first so original uploaded temp remains intact
        if ($current_image !== $output_image) {
            copy($current_image, $output_image);
            $current_image = $output_image;
        }
    }

    // Keep dates in sync
    $date_candidate = $metadata['EXIF:DateTimeOriginal']
        ?? $metadata['DateTimeOriginal']
        ?? $metadata['EXIF:CreateDate']
        ?? $metadata['CreateDate']
        ?? null;

    $normalized_date = normalize_exif_datetime_php($date_candidate);
    if ($normalized_date) {
        $metadata['EXIF:DateTimeOriginal'] = $normalized_date;
        $metadata['EXIF:CreateDate'] = $normalized_date;
        $metadata['EXIF:ModifyDate'] = $normalized_date;
        $metadata['XMP:DateCreated'] = $normalized_date;
        $metadata['XMP:CreateDate'] = $normalized_date;
        $metadata['IPTC:DateCreated'] = str_replace(':', '-', substr($normalized_date, 0, 10));
        $metadata['IPTC:TimeCreated'] = substr($normalized_date, 11);
    }

    // Coordinates parsing
    $google_keys = ['GoogleMapsCoordinates', 'EXIF:GoogleMapsCoordinates'];
    foreach ($google_keys as $gkey) {
        if (isset($metadata[$gkey])) {
            $val = trim((string)$metadata[$gkey]);
            unset($metadata[$gkey]);
            if ($val !== '') {
                $parsed = parse_coordinates_php($val);
                if ($parsed) {
                    $metadata = array_merge($metadata, $parsed);
                }
            }
            break;
        }
    }

    $excluded_tags = [
        'SourceFile', 'ExifTool:ExifToolVersion', 'File:FileName', 'File:Directory',
        'File:FileSize', 'File:FileModifyDate', 'File:FileAccessDate', 'File:FileCreateDate',
        'File:FilePermissions', 'File:FileType', 'File:FileTypeExtension', 'File:MIMEType'
    ];

    // Build ExifTool arguments
    $args = ["-overwrite_original"];
    foreach ($metadata as $tag => $value) {
        if (in_array($tag, $excluded_tags, true)) continue;
        $clean_val = trim((string)$value);
        if (str_contains($tag, 'ISO')) {
            $clean_val = preg_replace('/\D/', '', $clean_val);
            if ($clean_val === '') continue;
        }
        if ($clean_val !== '') {
            $args[] = "-{$tag}={$clean_val}";
        }
    }

    // Use an args file for optimal speed and no command length limitations
    $argfile = tempnam(sys_get_temp_dir(), 'exif_args_');
    file_put_contents($argfile, implode("\n", $args));

    $cmd = 'exiftool -@ ' . escapeshellarg($argfile) . ' ' . escapeshellarg($current_image);
    $out = shell_exec($cmd);

    if (file_exists($argfile)) {
        @unlink($argfile);
    }

    if ($current_image !== $output_image && file_exists($current_image)) {
        if (file_exists($output_image)) @unlink($output_image);
        rename($current_image, $output_image);
    }

    return ['success' => true, 'output' => $output_image];
}
