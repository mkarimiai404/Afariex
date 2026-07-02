<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../admin_panel/config.php';

function json_response(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function get_request_data(): array
{
    $raw = file_get_contents('php://input');
    if (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return $decoded;
        }
    }

    return $_POST;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$data = get_request_data();

$userId = (int)($data['user_id'] ?? $data['id'] ?? $data['uid'] ?? 0);
$apiToken = trim((string)($data['api_token'] ?? $data['token'] ?? $data['user_token'] ?? ''));
$agency = trim((string)($data['agency'] ?? $data['agency_name'] ?? $data['agency_id'] ?? ''));
$senderName = trim((string)($data['sender_name'] ?? ''));
$receiverName = trim((string)($data['receiver_name'] ?? ''));
$receiverPhone = trim((string)($data['receiver_phone'] ?? ''));
$amountToman = (float)($data['amount_toman'] ?? 0);
$amountAfghani = (float)($data['amount_afn'] ?? 0);
$rate = (float)($data['rate'] ?? 0);

if ($userId <= 0) {
    json_response(['success' => false, 'message' => 'شناسه کاربر نامعتبر است.'], 400);
}

if ($amountToman <= 0 || $amountAfghani <= 0) {
    json_response(['success' => false, 'message' => 'مبلغ حواله معتبر نیست.'], 400);
}

if ($agency === '' || $senderName === '' || $receiverName === '' || $receiverPhone === '') {
    json_response(['success' => false, 'message' => 'اطلاعات حواله ناقص است.'], 400);
}

try {
    db()->beginTransaction();

    $userStmt = db()->prepare('SELECT id, balance, overdraft_limit FROM users WHERE id = ? LIMIT 1 FOR UPDATE');
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch();

    if (!$user) {
        db()->rollBack();
        json_response(['success' => false, 'message' => 'کاربر یافت نشد.'], 404);
    }

    $balance = (float)($user['balance'] ?? 0);
    $overdraftLimit = (float)($user['overdraft_limit'] ?? 0);
    $availableFunds = $balance + $overdraftLimit;

    if ($amountToman > $availableFunds) {
        db()->rollBack();
        json_response(['success' => false, 'message' => 'موجودی و اعتبار کاربر برای ثبت حواله کافی نیست.'], 400);
    }

    $insertStmt = db()->prepare('
        INSERT INTO remittances
            (user_id, agency, sender, receiver, amount_toman, amount_afghani, status, created_at)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, NOW())
    ');

    $status = 'pending';
    $insertStmt->execute([
        $userId,
        $agency,
        $senderName,
        $receiverName,
        $amountToman,
        $amountAfghani,
        $status,
    ]);

    $remittanceId = (int)db()->lastInsertId();

    $balanceStmt = db()->prepare('UPDATE users SET balance = balance - ? WHERE id = ?');
    $balanceStmt->execute([$amountToman, $userId]);

    db()->commit();

    json_response([
        'success' => true,
        'message' => 'حواله با موفقیت ثبت شد.',
        'data' => [
            'remittance_id' => $remittanceId,
            'tracking_number' => $remittanceId,
            'code' => $remittanceId,
            'agency_name' => $agency,
            'agency_address' => '',
        ],
    ]);
} catch (Throwable $e) {
    if (db()->inTransaction()) {
        db()->rollBack();
    }

    error_log('Add remittance failed: ' . $e->getMessage());

    json_response([
        'success' => false,
        'message' => 'خطا در ثبت حواله.',
    ], 500);
}
