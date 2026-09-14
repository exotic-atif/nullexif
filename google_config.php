<?php
/**
 * Simple Token Store (Development Only)
 * Stores Google OAuth tokens in a local text file (JSON payload).
 */

$TOKEN_FILE = __DIR__ . '/google_auth_token.txt';
$LEGACY_TOKEN_FILE = __DIR__ . '/.google_tokens.json';

function get_stored_tokens() {
    global $TOKEN_FILE, $LEGACY_TOKEN_FILE;
    $candidates = [$TOKEN_FILE, $LEGACY_TOKEN_FILE];

    foreach ($candidates as $file) {
        if (!file_exists($file)) {
            continue;
        }

        $raw = @file_get_contents($file);
        if ($raw === false || trim($raw) === '') {
            continue;
        }

        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }

    return null;
}

function save_tokens($data) {
    global $TOKEN_FILE, $LEGACY_TOKEN_FILE;
    $existing = get_stored_tokens() ?: [];
    $new_data = array_merge($existing, $data);
    $encoded = json_encode($new_data, JSON_PRETTY_PRINT);

    if ($encoded === false) {
        return false;
    }

    $written = @file_put_contents($TOKEN_FILE, $encoded, LOCK_EX);
    if ($written === false) {
        return false;
    }

    // Cleanup legacy file after successful write to the new text file.
    if (file_exists($LEGACY_TOKEN_FILE)) {
        @unlink($LEGACY_TOKEN_FILE);
    }

    return true;
}

function clear_stored_tokens() {
    global $TOKEN_FILE, $LEGACY_TOKEN_FILE;
    if (file_exists($TOKEN_FILE)) {
        @unlink($TOKEN_FILE);
    }
    if (file_exists($LEGACY_TOKEN_FILE)) {
        @unlink($LEGACY_TOKEN_FILE);
    }
}

function hydrate_session_from_tokens() {
    $tokens = get_stored_tokens();
    if (!$tokens || !is_array($tokens)) {
        return false;
    }

    $_SESSION['google_access_token'] = $tokens['access_token'] ?? null;
    $_SESSION['google_refresh_token'] = $tokens['refresh_token'] ?? null;
    $_SESSION['google_token_expiry'] = $tokens['token_expiry'] ?? 0;
    $_SESSION['google_authenticated'] = !empty($tokens['access_token']) || !empty($tokens['refresh_token']);

    return $_SESSION['google_authenticated'] === true;
}

// Ensure session is started for other parts of the app, but we'll use the file too
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
if (session_status() === PHP_SESSION_NONE) { session_start(); }

// Load .env
$env_path = __DIR__ . '/.env';
if (file_exists($env_path)) {
    $lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            putenv(trim($name) . "=" . trim($value));
        }
    }
}

$GOOGLE_CLIENT_ID = getenv("G_CLIENT_ID");
$GOOGLE_CLIENT_SECRET = getenv("G_CLIENT_SECRET");
$GOOGLE_AUTH_URI = getenv("G_AUTH_URI");
$GOOGLE_REDIRECT_URI = $GOOGLE_AUTH_URI;
$GOOGLE_CURL_CA_BUNDLE = getenv("G_CURL_CA_BUNDLE");
$allow_insecure_env = getenv("G_ALLOW_INSECURE_SSL");
$GOOGLE_ALLOW_INSECURE_SSL = $allow_insecure_env === false ? true : strtolower((string)$allow_insecure_env) === 'true';

// Auto-sync from file to session if needed
hydrate_session_from_tokens();

function configure_google_curl($ch) {
    global $GOOGLE_CURL_CA_BUNDLE, $GOOGLE_ALLOW_INSECURE_SSL;

    // Prefer valid CA bundle if available.
    if (!empty($GOOGLE_CURL_CA_BUNDLE) && file_exists($GOOGLE_CURL_CA_BUNDLE)) {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_CAINFO, $GOOGLE_CURL_CA_BUNDLE);
        return;
    }

    // Safe defaults.
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);

    // Localhost dev fallback when machine CA chain is broken.
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $is_localhost = stripos($host, 'localhost') !== false || stripos($host, '127.0.0.1') !== false;
    if ($is_localhost && $GOOGLE_ALLOW_INSECURE_SSL) {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    }
}
?>
