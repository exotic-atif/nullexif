<?php
require_once 'google_config.php';

clear_stored_tokens();
session_unset();
session_destroy();

header('Content-Type: application/json');
echo json_encode(['success' => true]);
?>
