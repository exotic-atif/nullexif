<?php
require_once 'google_config.php';
require_once 'google_refresh.php';

hydrate_session_from_tokens();
$tokens = get_stored_tokens();
$authenticated = false;
$email = null;

if (is_array($tokens)) {
    $authenticated = !empty($tokens['access_token']) || !empty($tokens['refresh_token']);
    if (!empty($tokens['user_email'])) {
        $email = $tokens['user_email'];
    }
}

// If authenticated but email not cached yet, try to fetch email from tokeninfo
if ($authenticated && !$email && !empty($_SESSION['google_access_token'])) {
    $accessToken = $_SESSION['google_access_token'];
    $ch = curl_init("https://oauth2.googleapis.com/tokeninfo?access_token=" . urlencode($accessToken));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    configure_google_curl($ch);
    $res = curl_exec($ch);
    curl_close($ch);

    if ($res) {
        $info = json_decode($res, true);
        if (!empty($info['email'])) {
            $email = $info['email'];
            save_tokens(['user_email' => $email]);
        }
    }
}

header('Content-Type: application/json');
echo json_encode([
    'authenticated' => $authenticated,
    'email' => $email
]);
