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
    json_response(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$userId = (int)($_POST['user_id'] ?? $_POST['id'] ?? $_POST['uid'] ?? 0);
$amount = (float)($_POST['amount'] ?? 0);
$trackingCode = trim((string)($_POST['tracking_code'] ?? ''));

if ($userId <= 0) {
    json_response(['success' => false, 'message' => 'شناسه کاربر نامعتبر است.'], 400);
}

if ($amount <= 0) {
    json_response(['success' => false, 'message' => 'مبلغ معتبر نیست.'], 400);
}

if ($trackingCode === '') {
    $trackingCode = (string)random_int(100000, 999999999);
}

try {
    db()->beginTransaction();

    $userStmt = db()->prepare('SELECT id FROM users WHERE id = ? LIMIT 1 FOR UPDATE');
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch();

    if (!$user) {
        db()->rollBack();
        json_response(['success' => false, 'message' => 'کاربر یافت نشد.'], 404);
    }

    $uploadDir = __DIR__ . '/../admin_panel/uploads/receipts';
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
        db()->rollBack();
        json_response(['success' => false, 'message' => 'امکان ایجاد پوشه آپلود وجود ندارد.'], 500);
    }

    $receiptImagePath = null;

    if (isset($_FILES['receipt']) && is_array($_FILES['receipt']) && ($_FILES['receipt']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
        $file = $_FILES['receipt'];
        $maxSize = 5 * 1024 * 1024;

        if ((int)$file['size'] > $maxSize) {
            db()->rollBack();
            json_response(['success' => false, 'message' => 'حجم فایل نباید بیشتر از ۵ مگابایت باشد.'], 400);
        }

        $tmpName = (string)$file['tmp_name'];
        $originalName = (string)$file['name'];
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

        if (!in_array($extension, $allowedExtensions, true)) {
            db()->rollBack();
            json_response(['success' => false, 'message' => 'فرمت فایل معتبر نیست.'], 400);
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = (string)$finfo->file($tmpName);
        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!in_array($mime, $allowedMimes, true)) {
            db()->rollBack();
            json_response(['success' => false, 'message' => 'فایل انتخابی تصویر معتبر نیست.'], 400);
        }

        $fileName = 'deposit_' . date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
        $destination = $uploadDir . '/' . $fileName;

        if (!move_uploaded_file($tmpName, $destination)) {
            db()->rollBack();
            json_response(['success' => false, 'message' => 'آپلود فایل انجام نشد.'], 500);
        }

        $receiptImagePath = 'uploads/receipts/' . $fileName;
    }

    $stmt = db()->prepare("INSERT INTO transactions (user_id, amount, tracking_code, type, status, receipt_image, description, created_at) VALUES (?, ?, ?, 'deposit', 'pending', ?, ?, NOW())");
    $stmt->execute([
        $userId,
        $amount,
        $trackingCode,
        $receiptImagePath,
        'شارژ کیف پول',
    ]);

    $transactionId = (int)db()->lastInsertId();
    db()->commit();

    json_response([
        'success' => true,
        'message' => 'رسید شما با موفقیت ثبت شد و در انتظار تایید است.',
        'data' => [
            'transaction_id' => $transactionId,
            'tracking_code' => $trackingCode,
        ],
    ]);
} catch (Throwable $e) {
    if (db()->inTransaction()) {
        db()->rollBack();
    }

    json_response(['success' => false, 'message' => 'مشکل در ارتباط با سرور.'], 500);
}