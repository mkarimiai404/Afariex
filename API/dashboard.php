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

if ($userId <= 0) {
    json_response(['success' => false, 'message' => 'شناسه کاربر نامعتبر است.'], 400);
}

try {
    $stmt = db()->prepare('SELECT id, mobile, first_name, last_name, balance FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        json_response(['success' => false, 'message' => 'کاربر یافت نشد.'], 404);
    }

    $balance = (float)($user['balance'] ?? 0);

    $pendingDepositStmt = db()->prepare("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = ? AND type = 'deposit' AND status = 'pending'");
    $pendingDepositStmt->execute([$userId]);
    $pendingDeposits = (float)$pendingDepositStmt->fetchColumn();

    $approvedDepositStmt = db()->prepare("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = ? AND type = 'deposit' AND status = 'approved'");
    $approvedDepositStmt->execute([$userId]);
    $approvedDeposits = (float)$approvedDepositStmt->fetchColumn();

    $remittanceStmt = db()->prepare("SELECT COALESCE(SUM(amount_toman), 0) FROM remittances WHERE user_id = ?");
    $remittanceStmt->execute([$userId]);
    $totalRemittances = (float)$remittanceStmt->fetchColumn();

    json_response([
        'success' => true,
        'message' => 'اطلاعات کیف پول دریافت شد.',
        'user' => [
            'id' => (int)$user['id'],
            'mobile' => (string)($user['mobile'] ?? ''),
            'name' => trim((string)($user['first_name'] ?? '') . ' ' . (string)($user['last_name'] ?? '')),
            'balance' => $balance,
        ],
        'balance' => $balance,
        'data' => [
            'balance' => $balance,
            'pending_deposits' => $pendingDeposits,
            'approved_deposits' => $approvedDeposits,
            'total_remittances' => $totalRemittances,
        ],
        'meta' => [
            'api_token_received' => $apiToken !== '',
        ],
    ]);
} catch (Throwable $e) {
    json_response(['success' => false, 'message' => 'خطا در دریافت اطلاعات کیف پول.'], 500);
}