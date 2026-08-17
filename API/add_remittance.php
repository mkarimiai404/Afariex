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
    // This helper may create its verification table. Run schema setup before
    // the financial transaction because MySQL DDL implicitly commits.
    ensure_verification_schema();
    db()->beginTransaction();

    $userStmt = db()->prepare('SELECT id, balance, overdraft_limit FROM users WHERE api_token = ? LIMIT 1 FOR UPDATE');
    $userStmt->execute([$apiToken]);
    $user = $userStmt->fetch();
    if ($user) {
        // The authenticated token is authoritative; do not trust a client user_id.
        $userId = (int)$user['id'];
    }

    if (!$user) {
        db()->rollBack();
        json_response(['success' => false, 'message' => 'کاربر یافت نشد.'], 404);
    }

    $balance = (float)($user['balance'] ?? 0);
    $overdraftLimit = (float)($user['overdraft_limit'] ?? 0);
    $availableFunds = $balance + $overdraftLimit;

    $verification = verification_state($userId, true);
    $dailyUsage = daily_transaction_usage($userId, true);
    $dailyLimit = $verification['daily_limit'];
    if ($dailyLimit === null) {
        db()->rollBack();
        json_response(['success' => false, 'code' => 'GOLD_LIMIT_NOT_CONFIGURED', 'message' => 'سقف تراکنش سطح طلایی هنوز توسط مدیریت تنظیم نشده است.'], 503);
    }
    $dailyRemaining = max(0, (float)$dailyLimit - $dailyUsage);
    if ($amountToman > $dailyRemaining) {
        db()->rollBack();
        json_response(['success' => false, 'code' => 'DAILY_TRANSACTION_LIMIT_EXCEEDED', 'message' => 'سقف انتقال وجه مجاز برای حساب شما تکمیل شده است.', 'data' => ['level' => $verification['level'], 'daily_limit' => $dailyLimit, 'combined_daily_limit' => $dailyLimit, 'used_today' => $dailyUsage, 'remaining_today' => $dailyRemaining, 'requested_amount' => $amountToman, 'upgrade_required' => false]], 422);
    }
    $remittanceUsage = daily_remittance_usage($userId);
    $customRemittanceLimit = $verification['custom_remittance_limit'];
    if ($customRemittanceLimit !== null && $amountToman > max(0, (float)$customRemittanceLimit - $remittanceUsage)) {
        db()->rollBack();
        json_response(['success' => false, 'code' => 'CUSTOM_REMITTANCE_LIMIT_EXCEEDED', 'message' => 'سقف اختصاصی انتقال وجه مجاز برای حساب شما تکمیل شده است.', 'data' => ['custom_remittance_limit' => $customRemittanceLimit, 'remittance_used_today' => $remittanceUsage, 'remaining_remittance_today' => max(0, (float)$customRemittanceLimit - $remittanceUsage), 'requested_amount' => $amountToman]], 422);
    }

    if ($amountToman > $availableFunds) {
        db()->rollBack();
        json_response(['success' => false, 'code' => 'INSUFFICIENT_BALANCE', 'message' => 'موجودی و اعتبار کاربر برای ثبت حواله کافی نیست.'], 422);
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

    // Read the committed receipt fields from the saved row and the same agency
    // address source used by orders/history. Client supplied addresses are not
    // authoritative.
    $createdStmt = db()->prepare('SELECT r.created_at, r.status, r.sender, r.receiver,
            r.amount_afghani, r.agency,
            (SELECT a.address FROM agencies a WHERE BINARY a.name = BINARY r.agency ORDER BY a.id DESC LIMIT 1) AS agency_address
        FROM remittances r WHERE r.id = ? AND r.user_id = ? LIMIT 1');
    $createdStmt->execute([$remittanceId, $userId]);
    $savedRemittance = $createdStmt->fetch();
    if (!$savedRemittance) {
        throw new RuntimeException('Committed remittance could not be reloaded.');
    }

    $balanceStmt = db()->prepare('UPDATE users SET balance = balance - ? WHERE id = ? AND balance + overdraft_limit >= ?');
    $balanceStmt->execute([$amountToman, $userId, $amountToman]);
    if ($balanceStmt->rowCount() !== 1) {
        throw new RuntimeException('Wallet balance changed before remittance deduction.');
    }

    db()->commit();

    $agencyAddress = trim((string)($savedRemittance['agency_address'] ?? ''));
    $savedAgency = trim((string)($savedRemittance['agency'] ?? $agency));

    json_response([
        'success' => true,
        'message' => 'حواله با موفقیت ثبت شد.',
        'data' => [
            'remittance_id' => $remittanceId,
            'tracking_number' => $remittanceId,
            'code' => $remittanceId,
            'agency_name' => $savedAgency,
            'agency_address' => $agencyAddress,
            'status' => strtolower(trim((string)$savedRemittance['status'])),
            'created_at' => $savedRemittance['created_at'] ?: null,
            'sender' => trim((string)$savedRemittance['sender']),
            'receiver' => trim((string)$savedRemittance['receiver']),
            'amount_afghani' => (float)$savedRemittance['amount_afghani'],
            'destination' => $agencyAddress !== '' ? $agencyAddress : $savedAgency,
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
