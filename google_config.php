<?php
/**
 * Session-based Token Store
 * Stores Google OAuth tokens in the user's isolated PHP session.
 * Eliminates plain-text files on disk and prevents multi-user session collision.
 */

// Configure secure session cookie parameters
if (session_status() === PHP_SESSION_NONE) {
    $is_https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
        || (!empty($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443);

    session_set_cookie_params([
        'lifetime' => 0, // Session cookie lasts until browser is closed
        'path' => '/',
        'domain' => '',
        'secure' => $is_https,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

function get_stored_tokens() {
    if (!empty($_SESSION['google_tokens']) && is_array($_SESSION['google_tokens'])) {
        return $_SESSION['google_tokens'];
    }

    if (!empty($_SESSION['google_access_token']) || !empty($_SESSION['google_refresh_token'])) {
        return [
            'access_token' => $_SESSION['google_access_token'] ?? null,
            'refresh_token' => $_SESSION['google_refresh_token'] ?? null,
            'token_expiry' => $_SESSION['google_token_expiry'] ?? 0,
            'user_email' => $_SESSION['google_user_email'] ?? null,
            'authenticated' => !empty($_SESSION['google_authenticated'])
        ];
    }

    return null;
}

function save_tokens($data) {
    if (!is_array($data)) {
        return false;
    }

    $existing = get_stored_tokens() ?: [];
    $merged = array_merge($existing, $data);
    $_SESSION['google_tokens'] = $merged;

    if (isset($merged['access_token'])) {
        $_SESSION['google_access_token'] = $merged['access_token'];
    }
    if (isset($merged['refresh_token'])) {
        $_SESSION['google_refresh_token'] = $merged['refresh_token'];
    }
    if (isset($merged['token_expiry'])) {
        $_SESSION['google_token_expiry'] = $merged['token_expiry'];
    }
    if (isset($merged['user_email'])) {
        $_SESSION['google_user_email'] = $merged['user_email'];
    }
    $_SESSION['google_authenticated'] = !empty($_SESSION['google_access_token']) || !empty($_SESSION['google_refresh_token']);

    return true;
}

function clear_stored_tokens() {
    unset(
        $_SESSION['google_tokens'],
        $_SESSION['google_access_token'],
        $_SESSION['google_refresh_token'],
        $_SESSION['google_token_expiry'],
        $_SESSION['google_authenticated'],
        $_SESSION['google_user_email']
    );
}

function hydrate_session_from_tokens() {
    $tokens = get_stored_tokens();
    if (!$tokens || !is_array($tokens)) {
        return false;
    }

    $_SESSION['google_access_token'] = $tokens['access_token'] ?? null;
    $_SESSION['google_refresh_token'] = $tokens['refresh_token'] ?? null;
    $_SESSION['google_token_expiry'] = $tokens['token_expiry'] ?? 0;
    $_SESSION['google_user_email'] = $tokens['user_email'] ?? null;
    $_SESSION['google_authenticated'] = !empty($_SESSION['google_access_token']) || !empty($_SESSION['google_refresh_token']);

    return $_SESSION['google_authenticated'] === true;
}

// Load .env for local development if present (environment variables from host/Render take precedence)
$env_path = __DIR__ . '/.env';
if (file_exists($env_path)) {
    $lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || strpos($trimmed, '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);
            if (getenv($name) === false) {
                putenv("$name=$value");
                $_ENV[$name] = $value;
                $_SERVER[$name] = $value;
            }
        }
    }
}

function get_config_val($key, $default = null) {
    $val = getenv($key);
    if ($val !== false && $val !== '') return $val;
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') return $_ENV[$key];
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') return $_SERVER[$key];
    return $default;
}

$GOOGLE_CLIENT_ID = get_config_val("G_CLIENT_ID");
$GOOGLE_CLIENT_SECRET = get_config_val("G_CLIENT_SECRET");
$GOOGLE_AUTH_URI = get_config_val("G_AUTH_URI");
$GOOGLE_REDIRECT_URI = $GOOGLE_AUTH_URI;
$GOOGLE_CURL_CA_BUNDLE = get_config_val("G_CURL_CA_BUNDLE");
$allow_insecure_env = get_config_val("G_ALLOW_INSECURE_SSL");
$GOOGLE_ALLOW_INSECURE_SSL = $allow_insecure_env === null ? true : strtolower((string)$allow_insecure_env) === 'true';

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
