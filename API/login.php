<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');

$allowedOrigins = ['http://localhost:8081', 'http://127.0.0.1:8081', 'https://afariex.ir'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function login_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    login_json(['success' => false, 'status' => 'error', 'code' => 'METHOD_NOT_ALLOWED'], 405);
}

try {
require_once __DIR__ . '/../admin_panel/config.php';
    require_once __DIR__ . '/includes/phone.php';
    $mobile = normalize_iran_mobile((string)($_POST['mobile'] ?? ''));
    $password = (string)($_POST['password'] ?? '');
    if ($mobile === null || $password === '') {
        login_json(['success' => false, 'status' => 'error', 'code' => 'CREDENTIALS_REQUIRED', 'message' => 'اطلاعات ورود را وارد کنید.'], 422);
    }

    $columns = db()->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN, 0);
    $select = ['id', 'mobile', 'password', 'api_token'];
    foreach (['full_name', 'first_name', 'last_name'] as $optional) {
        if (in_array($optional, $columns, true)) $select[] = $optional;
    }
    $statement = db()->prepare('SELECT ' . implode(', ', $select) . ' FROM users WHERE mobile = ? LIMIT 1');
    $statement->execute([$mobile]);
    $user = $statement->fetch();
    if (!$user || !password_verify($password, (string)$user['password'])) {
        login_json(['success' => false, 'status' => 'error', 'code' => 'LOGIN_FAILED', 'message' => 'شماره موبایل یا رمز عبور نادرست است.'], 401);
    }

    $apiToken = trim((string)($user['api_token'] ?? ''));
    if ($apiToken === '') {
        $apiToken = bin2hex(random_bytes(32));
        $tokenStatement = db()->prepare('UPDATE users SET api_token = ? WHERE id = ?');
        $tokenStatement->execute([$apiToken, (int)$user['id']]);
    }

    $fullName = trim((string)($user['full_name'] ?? ''));
    if ($fullName === '') {
        $fullName = trim((string)($user['first_name'] ?? '') . ' ' . (string)($user['last_name'] ?? ''));
    }
    login_json([
        'success' => true,
        'status' => 'success',
        'code' => 'LOGIN_SUCCESS',
        'data' => [
            'id' => (int)$user['id'],
            'user_id' => (int)$user['id'],
            'mobile' => (string)$user['mobile'],
            'full_name' => $fullName,
            'api_token' => $apiToken,
        ],
    ]);
} catch (Throwable $error) {
    error_log('Login API failure: ' . $error->getMessage());
    login_json(['success' => false, 'status' => 'error', 'code' => 'LOGIN_UNAVAILABLE', 'message' => 'ورود در حال حاضر در دسترس نیست.'], 500);
}
