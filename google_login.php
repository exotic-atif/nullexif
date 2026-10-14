<?php
require_once 'google_config.php';

// Generate cryptographically secure OAuth2 state parameter for CSRF mitigation
$state = bin2hex(random_bytes(32));
$_SESSION['oauth2_state'] = $state;

$auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" . http_build_query([
    'client_id' => $GOOGLE_CLIENT_ID,
    'redirect_uri' => $GOOGLE_REDIRECT_URI,
    'response_type' => 'code',
    'scope' => 'https://www.googleapis.com/auth/photoslibrary.appendonly https://www.googleapis.com/auth/userinfo.email',
    'access_type' => 'offline',
    'prompt' => 'select_account consent',
    'include_granted_scopes' => 'true',
    'state' => $state
]);

header('Content-Type: application/json');
echo json_encode(['url' => $auth_url]);
?>