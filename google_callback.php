<?php
require_once 'google_config.php';

$auth_success = false;
$auth_error = null;
$debug_info = [];

if (isset($_GET['code'])) {
    $code = $_GET['code'];
    $url = "https://oauth2.googleapis.com/token";
    $params = [
        'client_id' => $GOOGLE_CLIENT_ID,
        'client_secret' => $GOOGLE_CLIENT_SECRET,
        'redirect_uri' => $GOOGLE_REDIRECT_URI,
        'grant_type' => 'authorization_code',
        'code' => $code
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    configure_google_curl($ch);
    $response = curl_exec($ch);
    $curl_error = curl_error($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $token_data = is_string($response) ? json_decode($response, true) : null;
    if (!is_array($token_data)) {
        $token_data = [];
    }

    $debug_info = [
        'http_code' => $http_code,
        'curl_error' => $curl_error ?: null,
        'google_error' => $token_data['error'] ?? null,
        'google_error_description' => $token_data['error_description'] ?? null,
        'redirect_uri' => $GOOGLE_REDIRECT_URI
    ];

    if (isset($token_data['access_token'])) {
        $refresh_token = $token_data['refresh_token'] ?? null;
        $expiry = time() + (isset($token_data['expires_in']) ? $token_data['expires_in'] : 3600);
        
        $user_email = null;
        if (!empty($token_data['id_token'])) {
            $parts = explode('.', $token_data['id_token']);
            if (isset($parts[1])) {
                $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
                if (!empty($payload['email'])) {
                    $user_email = $payload['email'];
                }
            }
        }

        // Store tokens securely in user's isolated PHP session
        $saved = save_tokens([
            'access_token' => $token_data['access_token'],
            'refresh_token' => $refresh_token,
            'token_expiry' => $expiry,
            'authenticated' => true,
            'user_email' => $user_email
        ]);
        if ($saved === false) {
            $auth_error = 'Failed to store session tokens';
        } else {
            $auth_success = true;
        }
    } else {
        if (!empty($curl_error)) {
            $auth_error = 'Token exchange failed: ' . $curl_error;
        } else {
            $auth_error = $token_data['error_description'] ?? $token_data['error'] ?? 'Token exchange failed';
        }
    }
} elseif (isset($_GET['error'])) {
    $auth_error = $_GET['error'];
}

if (!$auth_success) {
    $log_line = '[' . date('c') . '] OAuth callback failed: ' . json_encode($debug_info) . PHP_EOL;
    @file_put_contents(__DIR__ . '/google_oauth_error.log', $log_line, FILE_APPEND | LOCK_EX);
}
?>
<!DOCTYPE html>
<html>
<body>
<script>
if (window.opener) {
    window.opener.postMessage({
        type: <?php echo json_encode($auth_success ? "GOOGLE_AUTH_SUCCESS" : "GOOGLE_AUTH_FAILED"); ?>,
        error: <?php echo json_encode($auth_error); ?>,
        debug: <?php echo json_encode($debug_info); ?>
    }, "*");
}
window.close();
</script>
</body>
</html>
