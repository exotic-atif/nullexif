<?php
require_once 'google_config.php';
require_once 'google_refresh.php';

header('Content-Type: application/json');

hydrate_session_from_tokens();

if (!isset($_SESSION['google_authenticated']) || !$_SESSION['google_authenticated']) {
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

if ((isset($_SESSION['google_token_expiry']) && time() > $_SESSION['google_token_expiry']) || empty($_SESSION['google_access_token'])) {
    if (!perform_refresh()) {
        echo json_encode(['error' => 'Authentication expired. Please sign in again.']);
        exit;
    }
}

$accessToken = $_SESSION['google_access_token'] ?? null;
if (!$accessToken) {
    echo json_encode(['error' => 'Missing access token']);
    exit;
}

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents('php://input'), true) ?? [];

// 1. Action: Start Resumable Upload Session
if ($action === 'start_resumable') {
    $filePath = $data['path'] ?? '';
    if (strpos($filePath, 'uploads/') !== 0 || !file_exists($filePath)) {
        echo json_encode(['error' => 'Invalid file path or file not found']);
        exit;
    }

    $fileName = basename($filePath);
    $fileSize = filesize($filePath);
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $filePath) ?: 'image/jpeg';
    finfo_close($finfo);

    $uploadUrl = "https://photoslibrary.googleapis.com/v1/uploads";
    $ch = curl_init($uploadUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    configure_google_curl($ch);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $accessToken",
        "Content-type: application/octet-stream",
        "X-Goog-Upload-Protocol: resumable",
        "X-Goog-Upload-Command: start",
        "X-Goog-Upload-Header-Content-Length: $fileSize",
        "X-Goog-Upload-Header-Content-Type: $mimeType",
        "X-Goog-Upload-File-Name: $fileName"
    ]);

    $response = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $headersRaw = substr($response, 0, $headerSize);
    $uploadSessionUrl = null;
    if (preg_match('/X-Goog-Upload-URL:\s*(.+)/i', $headersRaw, $matches)) {
        $uploadSessionUrl = trim($matches[1]);
    }

    if ($httpCode === 200 && $uploadSessionUrl) {
        echo json_encode([
            'success' => true,
            'upload_url' => $uploadSessionUrl,
            'file_size' => $fileSize,
            'file_name' => $fileName,
            'mime_type' => $mimeType
        ]);
    } else {
        echo json_encode([
            'error' => 'Failed to initialize resumable session',
            'http_code' => $httpCode,
            'details' => $headersRaw
        ]);
    }
    exit;
}

// 2. Action: Create Media Item after uploadToken obtained
if ($action === 'create_media_item') {
    $uploadToken = $data['upload_token'] ?? '';
    if (!$uploadToken) {
        echo json_encode(['error' => 'Missing upload token']);
        exit;
    }

    $fileName = $data['file_name'] ?? null;
    $simpleItem = ['uploadToken' => $uploadToken];
    if ($fileName) {
        $simpleItem['fileName'] = $fileName;
    }

    $createUrl = "https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate";
    $postData = [
        'newMediaItems' => [
            [
                'simpleMediaItem' => $simpleItem
            ]
        ]
    ];

    $ch = curl_init($createUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    configure_google_curl($ch);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $accessToken",
        "Content-type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    $responseStr = curl_exec($ch);
    curl_close($ch);

    echo $responseStr;
    exit;
}

// 3. Fallback / Standard direct upload
$filePath = $data['path'] ?? '';
if (strpos($filePath, 'uploads/') !== 0 || !file_exists($filePath)) {
    echo json_encode(['error' => 'Invalid file path or file not found']);
    exit;
}

$fileName = !empty($data['file_name']) ? basename($data['file_name']) : basename($filePath);

// Step 1: Upload binary
$uploadUrl = "https://photoslibrary.googleapis.com/v1/uploads";
$ch = curl_init($uploadUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
configure_google_curl($ch);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $accessToken",
    "Content-type: application/octet-stream",
    "X-Goog-Upload-File-Name: $fileName",
    "X-Goog-Upload-Protocol: raw"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents($filePath));
$uploadToken = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    echo json_encode(['error' => 'Binary upload failed', 'details' => $uploadToken]);
    exit;
}

// Step 2: Create media item
$createUrl = "https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate";
$postData = [
    'newMediaItems' => [
        [
            'simpleMediaItem' => [
                'uploadToken' => $uploadToken,
                'fileName' => $fileName
            ]
        ]
    ]
];

$ch = curl_init($createUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
configure_google_curl($ch);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $accessToken",
    "Content-type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
$responseStr = curl_exec($ch);
curl_close($ch);

echo $responseStr;
