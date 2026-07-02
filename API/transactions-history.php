<?php
declare(strict_types=1);

require_once __DIR__ . '/../admin_panel/config.php';

header('Content-Type: application/json; charset=utf-8');

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

if ($userId <= 0 && $apiToken === '') {
    json_response(['status' => 'error', 'message' => 'شناسه کاربر یا توکن معتبر نیست.'], 400);
}

$where = [];
$params = [];

if ($userId > 0) {
    $where[] = 't.user_id = ?';
    $params[] = $userId;
}

if ($apiToken !== '') {
    $where[] = 'u.api_token = ?';
    $params[] = $apiToken;
}

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

    json_response([
        'status' => 'success',
        'data' => $rows,
    ]);
} catch (Throwable $e) {
    json_response(['status' => 'error', 'message' => 'ارتباط با سرور برقرار نشد.'], 500);
}