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

function orders_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    require_once __DIR__ . '/../admin_panel/config.php';
    $input = $_POST;
    if (!$input && stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== false) {
        $decoded = json_decode((string)file_get_contents('php://input'), true);
        $input = is_array($decoded) ? $decoded : [];
    }
    $apiToken = trim((string)($input['api_token'] ?? $input['token'] ?? $input['user_token'] ?? ''));
    if ($apiToken === '') orders_json(['success' => false, 'code' => 'AUTHENTICATION_REQUIRED'], 401);

    $pdo = db();
    $userStmt = $pdo->prepare('SELECT id FROM users WHERE api_token = ? LIMIT 1');
    $userStmt->execute([$apiToken]);
    $user = $userStmt->fetch();
    if (!$user) orders_json(['success' => false, 'code' => 'AUTHENTICATION_FAILED'], 401);
    $userId = (int)$user['id'];
    $orders = [];

    if (table_exists('transactions')) {
        $transactionStmt = $pdo->prepare('SELECT id, amount, type, status, description, created_at FROM transactions WHERE user_id = ? ORDER BY id DESC');
        $transactionStmt->execute([$userId]);
        foreach ($transactionStmt->fetchAll() as $row) {
            $type = strtolower(trim((string)($row['type'] ?? '')));
            if (!in_array($type, ['deposit', 'withdraw', 'withdrawal'], true)) continue;
            $orders[] = [
                'id' => 'transaction-' . (int)$row['id'],
                'type' => $type === 'deposit' ? 'deposit' : 'withdrawal',
                'title' => $type === 'deposit' ? 'افزایش موجودی' : 'برداشت وجه',
                'amount' => (float)($row['amount'] ?? 0),
                'currency' => 'تومان',
                'status' => strtolower(trim((string)($row['status'] ?? 'pending'))),
                'created_at' => $row['created_at'] ?? null,
                'description' => $type === 'deposit' ? 'درخواست افزایش موجودی کیف پول' : 'درخواست برداشت از کیف پول',
                'metadata' => [],
            ];
        }
    }

    if (table_exists('remittances')) {
        $remittanceStmt = $pdo->prepare('SELECT r.id, r.amount_toman, r.amount_afghani, r.status, r.created_at,
            r.sender, r.receiver, r.agency,
            (SELECT a.address FROM agencies a WHERE BINARY a.name = BINARY r.agency ORDER BY a.id DESC LIMIT 1) AS agency_address
            FROM remittances r WHERE r.user_id = ? ORDER BY r.id DESC');
        $remittanceStmt->execute([$userId]);
        foreach ($remittanceStmt->fetchAll() as $row) {
            $orders[] = [
                'id' => 'remittance-' . (int)$row['id'],
                'type' => 'remittance',
                'title' => 'حواله',
                'amount' => (float)($row['amount_toman'] ?? 0),
                'currency' => 'تومان',
                'status' => strtolower(trim((string)($row['status'] ?? 'pending'))),
                'created_at' => $row['created_at'] ?? null,
                'description' => 'درخواست حواله ثبت‌شده',
                'metadata' => [
                    'tracking_number' => (int)$row['id'],
                    'sender' => trim((string)($row['sender'] ?? '')),
                    'receiver' => trim((string)($row['receiver'] ?? '')),
                    'amount_afghani' => (float)($row['amount_afghani'] ?? 0),
                    'destination' => trim((string)($row['agency_address'] ?? '')) !== ''
                        ? trim((string)$row['agency_address'])
                        : trim((string)($row['agency'] ?? '')),
                ],
            ];
        }
    }

    usort($orders, static fn (array $left, array $right): int => strcmp((string)($right['created_at'] ?? ''), (string)($left['created_at'] ?? '')));
    orders_json([
        'success' => true,
        'code' => 'ORDERS_LOADED',
        'data' => [
            'orders' => $orders,
            'total' => count($orders),
            'latest_activity' => $orders[0]['created_at'] ?? null,
        ],
    ]);
} catch (Throwable $error) {
    error_log('Orders API failure: ' . $error->getMessage());
    orders_json(['success' => false, 'code' => 'ORDERS_UNAVAILABLE'], 500);
}
