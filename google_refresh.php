<?php
require_once 'google_config.php';

function perform_refresh() {
    global $GOOGLE_CLIENT_ID, $GOOGLE_CLIENT_SECRET;
    
    $tokens = get_stored_tokens();
    $refresh_token = $tokens['refresh_token'] ?? $_SESSION['google_refresh_token'] ?? null;
    
    if (!$refresh_token) {
        return false;
    }

    $url = "https://oauth2.googleapis.com/token";
    $params = [
        'grant_type' => 'refresh_token',
        'refresh_token' => $refresh_token,
        'client_id' => $GOOGLE_CLIENT_ID,
        'client_secret' => $GOOGLE_CLIENT_SECRET
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    configure_google_curl($ch);
    $response = curl_exec($ch);
    curl_close($ch);

    $token_data = json_decode($response, true);

    if (isset($token_data['access_token'])) {
        $new_expiry = time() + (isset($token_data['expires_in']) ? $token_data['expires_in'] : 3600);
        
        $saved = save_tokens([
            'access_token' => $token_data['access_token'],
            'token_expiry' => $new_expiry,
            'authenticated' => true
        ]);
        if ($saved === false) {
            return false;
        }

        $_SESSION['google_access_token'] = $token_data['access_token'];
        $_SESSION['google_token_expiry'] = $new_expiry;
        $_SESSION['google_authenticated'] = true;
        return true;
    }
    return false;
}

// Check if refresh is needed
$tokens = get_stored_tokens();
$expiry = $tokens['token_expiry'] ?? $_SESSION['google_token_expiry'] ?? 0;
if ($expiry > 0 && time() > $expiry - 60) {
    perform_refresh();
}

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') == 'google_refresh.php') {
    header('Content-Type: application/json');
    echo json_encode(['success' => true]);
    exit;
}
?>
