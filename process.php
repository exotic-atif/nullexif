<?php
header('Content-Type: application/json');
require_once __DIR__ . '/exif_engine.php';

$uploads_dir = 'uploads/';
if (!is_dir($uploads_dir)) {
    mkdir($uploads_dir, 0777, true);
}

$action = $_GET['action'] ?? '';

if ($action === 'upload_target' || $action === 'upload_source') {
    $uploaded_files = [];

    // Handle multi-file uploads (bulk)
    if (isset($_FILES['images']) && is_array($_FILES['images']['name'])) {
        $count = count($_FILES['images']['name']);
        for ($i = 0; $i < $count; $i++) {
            if ($_FILES['images']['error'][$i] === UPLOAD_ERR_OK) {
                $orig_name = basename($_FILES['images']['name'][$i]);
                $target_path = $uploads_dir . time() . '_' . $i . '_' . $orig_name;
                if (move_uploaded_file($_FILES['images']['tmp_name'][$i], $target_path)) {
                    $meta = ($i === 0) ? get_metadata_direct($target_path) : [];
                    $uploaded_files[] = [
                        'success' => true,
                        'path' => $target_path,
                        'metadata' => $meta,
                        'filename' => $orig_name,
                        'extension' => strtolower(pathinfo($orig_name, PATHINFO_EXTENSION)),
                        'size' => filesize($target_path)
                    ];
                }
            }
        }
    }
    // Handle single file upload
    elseif (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['image'];
        $filename = basename($file['name']);
        $target_path = $uploads_dir . time() . '_' . $filename;

        if (move_uploaded_file($file['tmp_name'], $target_path)) {
            $meta = get_metadata_direct($target_path);
            $uploaded_files[] = [
                'success' => true,
                'path' => $target_path,
                'metadata' => $meta,
                'filename' => $filename,
                'extension' => strtolower(pathinfo($filename, PATHINFO_EXTENSION)),
                'size' => filesize($target_path)
            ];
        }
    }

    if (empty($uploaded_files)) {
        echo json_encode(['error' => 'No image uploaded or upload failed']);
        exit;
    }

    // If single, return top-level object for backward compatibility + files array
    $primary = $uploaded_files[0];
    $primary['files'] = $uploaded_files;
    echo json_encode($primary);
    exit;
}
elseif ($action === 'proceed') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data) {
        echo json_encode(['error' => 'Invalid request data']);
        exit;
    }

    $target_images = $data['target_images'] ?? [];
    if (empty($target_images) && !empty($data['target_image'])) {
        $target_images = [$data['target_image']];
    }

    $metadata = $data['metadata'] ?? [];
    $convert_to = $data['convert_to'] ?? null;

    $results = [];
    foreach ($target_images as $target_image) {
        if (!file_exists($target_image)) continue;

        // Determine date from metadata set by user (YYYYMMDD_HHMM)
        $date_candidate = $metadata['EXIF:DateTimeOriginal']
            ?? $metadata['DateTimeOriginal']
            ?? $metadata['EXIF:CreateDate']
            ?? $metadata['CreateDate']
            ?? $metadata['EXIF:ModifyDate']
            ?? $metadata['ModifyDate']
            ?? null;

        $day = null; $month = null; $year = null; $hour = null; $min = null;
        if ($date_candidate && preg_match('/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})/', trim($date_candidate), $m)) {
            $year = $m[1];
            $month = $m[2];
            $day = $m[3];
            $hour = $m[4];
            $min = $m[5];
        }

        if (!$year) {
            // Check if file already has EXIF date
            $existing = get_metadata_direct($target_image);
            $ex_date = $existing['EXIF:DateTimeOriginal'] ?? $existing['DateTimeOriginal'] ?? $existing['EXIF:CreateDate'] ?? null;
            if ($ex_date && preg_match('/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})/', trim($ex_date), $m)) {
                $year = $m[1];
                $month = $m[2];
                $day = $m[3];
                $hour = $m[4];
                $min = $m[5];
            }
        }

        if (!$year) {
            // Fallback to current timestamp
            $now = new DateTime();
            $day = $now->format('d');
            $month = $now->format('m');
            $year = $now->format('Y');
            $hour = $now->format('H');
            $min = $now->format('i');
        }

        $base_name = sprintf('%04d%02d%02d_%02d%02d', (int)$year, (int)$month, (int)$day, (int)$hour, (int)$min);

        // Extension
        if (!empty($convert_to)) {
            $extension = '.' . strtolower($convert_to);
        } else {
            $info = pathinfo($target_image);
            $extension = isset($info['extension']) ? '.' . strtolower($info['extension']) : '.jpg';
        }

        $output_filename = $base_name . $extension;
        $counter = 1;
        while (file_exists($uploads_dir . $output_filename)) {
            $output_filename = $base_name . '_' . $counter . $extension;
            $counter++;
        }
        $output_path = $uploads_dir . $output_filename;

        $res = apply_metadata_direct($target_image, $metadata, $output_path, $convert_to);
        if (!empty($res['success'])) {
            $results[] = [
                'success' => true,
                'path' => $res['output'],
                'filename' => basename($res['output']),
                'size' => filesize($res['output'])
            ];
        }
    }

    if (empty($results)) {
        echo json_encode(['error' => 'Failed to process any target images']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'output' => $results[0]['path'],
        'outputs' => $results
    ]);
    exit;
}
elseif ($action === 'clear_uploads') {
    $dir = 'uploads/';
    $files = glob($dir . '*');

    foreach ($files as $file) {
        if (is_file($file)) {
            @unlink($file);
        }
    }

    echo json_encode(['success' => true]);
    exit;
}
elseif ($action === 'get_presets') {
    if (file_exists("presets.json")) {
        echo file_get_contents("presets.json");
    } else {
        echo json_encode([]);
    }
    exit;
}
else {
    echo json_encode(['error' => 'Invalid action']);
}
