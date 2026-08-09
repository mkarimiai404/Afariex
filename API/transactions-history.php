<?php
declare(strict_types=1);

$allowedOrigins = ['http://localhost:8081', 'http://127.0.0.1:8081', 'https://afariex.ir'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../admin_panel/config.php';

function json_response(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['status' => 'error', 'message' => 'Method not allowed.'], 405);
}

$userId = (int)($_POST['user_id'] ?? 0);
$apiToken = trim((string)($_POST['api_token'] ?? ''));

if ($apiToken === '') {
    json_response(['status' => 'error', 'code' => 'AUTHENTICATION_REQUIRED', 'message' => 'نشست کاربری معتبر نیست.'], 401);
}

try {
    $authenticatedUserStmt = db()->prepare('SELECT id FROM users WHERE api_token = ? LIMIT 1');
    $authenticatedUserStmt->execute([$apiToken]);
    $authenticatedUserId = (int)($authenticatedUserStmt->fetchColumn() ?: 0);
    if ($authenticatedUserId <= 0 || ($userId > 0 && $userId !== $authenticatedUserId)) {
        json_response(['status' => 'error', 'code' => 'AUTHENTICATION_FAILED', 'message' => 'نشست کاربری معتبر نیست.'], 401);
    }
    $userId = $authenticatedUserId;
} catch (Throwable $e) {
    json_response(['status' => 'error', 'message' => 'ارتباط با سرور برقرار نشد.'], 500);
}

$where = ['t.user_id = ?', 'u.api_token = ?'];
$params = [$userId, $apiToken];

try {
    $sql = "
        SELECT
            t.id,
            t.user_id,
            u.mobile AS source,
            t.amount,
            t.tracking_code,
            t.type,
            t.status,
            COALESCE(t.receipt_image, '') AS receipt_image,
            t.created_at,
            COALESCE(t.description, '') AS description,
            CASE
                WHEN t.receipt_image IS NOT NULL AND t.receipt_image <> '' THEN CONCAT('https://afariex.ir/admin_panel/', t.receipt_image)
                ELSE ''
            END AS receipt_full_url
        FROM transactions t
        INNER JOIN users u ON u.id = t.user_id
    ";

    if ($where !== []) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }

    $sql .= ' ORDER BY t.id DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (table_exists('remittances')) {
        $remittanceWhere = [];
        $remittanceParams = [];
        $remittanceWhere[] = 'r.user_id = ?';
        $remittanceParams[] = $userId;
        $remittanceWhere[] = 'u.api_token = ?';
        $remittanceParams[] = $apiToken;

        $remittanceSql = "
            SELECT
                CONCAT('remittance-', r.id) AS id,
                r.id AS raw_id,
                r.user_id,
                u.mobile AS source,
                r.amount_toman AS amount,
                '' AS tracking_code,
                'remittance' AS type,
                r.status,
                '' AS receipt_image,
                r.created_at,
                COALESCE(r.description, '') AS description,
                '' AS receipt_full_url
            FROM remittances r
            INNER JOIN users u ON u.id = r.user_id
        ";
        if ($remittanceWhere !== []) {
            $remittanceSql .= ' WHERE ' . implode(' AND ', $remittanceWhere);
        }
        $remittanceStmt = db()->prepare($remittanceSql . ' ORDER BY r.id DESC');
        $remittanceStmt->execute($remittanceParams);
        $rows = array_merge($rows, $remittanceStmt->fetchAll(PDO::FETCH_ASSOC));
        usort($rows, static fn (array $left, array $right): int => strcmp((string)($right['created_at'] ?? ''), (string)($left['created_at'] ?? '')));
    }

    json_response([
        'status' => 'success',
        'data' => $rows,
    ]);
} catch (Throwable $e) {
    json_response(['status' => 'error', 'message' => 'ارتباط با سرور برقرار نشد.'], 500);
}
