<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(E_ALL);

$allowedOrigins = ['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:19006', 'http://127.0.0.1:19006', 'https://afariex.ir'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function referrals_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function masked_mobile(?string $mobile): ?string
{
    $value = trim((string)$mobile);
    if ($value === '') return null;
    $length = strlen($value);
    if ($length <= 6) return str_repeat('*', $length);
    return substr($value, 0, 4) . str_repeat('*', max(4, $length - 7)) . substr($value, -3);
}

try {
    require_once __DIR__ . '/../admin_panel/config.php';
    $input = $_POST;
    if (!$input && stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== false) {
        $decoded = json_decode((string)file_get_contents('php://input'), true);
        $input = is_array($decoded) ? $decoded : [];
    }
    $apiToken = trim((string)($input['api_token'] ?? $input['token'] ?? $input['user_token'] ?? ''));
    if ($apiToken === '') referrals_json(['success' => false, 'code' => 'AUTHENTICATION_REQUIRED'], 401);

    $pdo = db();
    $columns = $pdo->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN, 0);
    $userSelect = ['id'];
    foreach (['referral_code', 'created_at'] as $column) {
        if (in_array($column, $columns, true)) $userSelect[] = $column;
    }
    $userStmt = $pdo->prepare('SELECT ' . implode(', ', $userSelect) . ' FROM users WHERE api_token = ? LIMIT 1');
    $userStmt->execute([$apiToken]);
    $user = $userStmt->fetch();
    if (!$user) referrals_json(['success' => false, 'code' => 'AUTHENTICATION_FAILED'], 401);

    $userId = (int)$user['id'];
    $referralCode = trim((string)($user['referral_code'] ?? ''));
    // Existing accounts receive a stable, non-sensitive fallback until the migration is populated.
    if ($referralCode === '') $referralCode = 'AFX-' . str_pad((string)$userId, 5, '0', STR_PAD_LEFT);

    $customers = [];
    if (in_array('referred_by_user_id', $columns, true)) {
        $customerColumns = ['id', 'mobile'];
        foreach (['full_name', 'first_name', 'last_name', 'created_at'] as $column) {
            if (in_array($column, $columns, true)) $customerColumns[] = $column;
        }
        $customerStmt = $pdo->prepare('SELECT ' . implode(', ', $customerColumns) . ' FROM users WHERE referred_by_user_id = ? ORDER BY id DESC');
        $customerStmt->execute([$userId]);
        foreach ($customerStmt->fetchAll() as $customer) {
            $verification = verification_state((int)$customer['id']);
            $firstName = trim((string)($customer['first_name'] ?? ''));
            $lastName = trim((string)($customer['last_name'] ?? ''));
            $name = trim((string)($customer['full_name'] ?? '')) ?: trim($firstName . ' ' . $lastName);
            $customers[] = [
                'id' => (int)$customer['id'],
                'name' => $name !== '' ? $name : null,
                'mobile' => masked_mobile($customer['mobile'] ?? null),
                'registered_at' => $customer['created_at'] ?? null,
                'level' => $verification['level'],
                'level_title' => $verification['level_title'],
                'verified' => (bool)$verification['bronze_eligible'],
            ];
        }
    }
    $activeCount = count(array_filter($customers, static fn (array $customer): bool => $customer['verified']));
    referrals_json([
        'success' => true,
        'code' => 'REFERRALS_LOADED',
        'data' => [
            'referral_code' => $referralCode,
            'total_invited' => count($customers),
            'active_invited' => $activeCount,
            'started_at' => $user['created_at'] ?? null,
            'customers' => $customers,
        ],
    ]);
} catch (Throwable $error) {
    error_log('Referrals API failure: ' . $error->getMessage());
    referrals_json(['success' => false, 'code' => 'REFERRALS_UNAVAILABLE'], 500);
}
