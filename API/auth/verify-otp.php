<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/otp.php';
otp_cors();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') otp_json(['success'=>false,'code'=>'METHOD_NOT_ALLOWED'],405);
$input = otp_input();
$purpose = trim((string)($input['purpose'] ?? ''));
$mobile = normalize_iran_mobile((string)($input['mobile'] ?? ''));
$code = otp_normalized_code((string)($input['otp'] ?? $input['code'] ?? ''));
if (!otp_purpose($purpose) || preg_match('/^\d{6}$/', $code) !== 1 || ($purpose === 'registration' && $mobile === null)) otp_json(['success'=>false,'code'=>'INVALID_OTP','message'=>'کد تأیید صحیح نیست.'],422);
try {
    $pdo = db();
    $userId = null;
    if ($purpose !== 'registration') {
        $token = trim((string)($input['api_token'] ?? $input['token'] ?? ''));
        $stmt = $pdo->prepare('SELECT id, mobile FROM users WHERE api_token = ? LIMIT 1'); $stmt->execute([$token]); $user = $stmt->fetch();
        $userMobile = $user ? normalize_iran_mobile((string)$user['mobile']) : null;
        if (!$user || $userMobile === null || ($mobile !== null && $userMobile !== $mobile)) otp_json(['success'=>false,'code'=>'AUTHENTICATION_FAILED'],401);
        $mobile = $userMobile;
        $userId = (int)$user['id'];
    }
    $query = $userId === null
        ? 'SELECT * FROM phone_verification_codes WHERE user_id IS NULL AND mobile = ? AND purpose = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE'
        : 'SELECT * FROM phone_verification_codes WHERE user_id = ? AND mobile = ? AND purpose = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE';
    $pdo->beginTransaction();
    $stmt = $pdo->prepare($query); $userId === null ? $stmt->execute([$mobile,$purpose]) : $stmt->execute([$userId,$mobile,$purpose]); $row = $stmt->fetch();
    if (!$row || strtotime((string)$row['expires_at']) < time()) { $pdo->rollBack(); otp_json(['success'=>false,'code'=>'OTP_EXPIRED','message'=>'کد تأیید منقضی شده است.'],422); }
    if ((int)$row['attempts'] >= 5) { $pdo->rollBack(); otp_json(['success'=>false,'code'=>'OTP_ATTEMPTS_EXCEEDED','message'=>'تعداد تلاش‌ها بیش از حد مجاز است.'],429); }
    if (!password_verify($code, (string)$row['code_hash'])) { $pdo->prepare('UPDATE phone_verification_codes SET attempts = attempts + 1 WHERE id = ?')->execute([(int)$row['id']]); $pdo->commit(); otp_json(['success'=>false,'code'=>'INVALID_OTP','message'=>'کد واردشده صحیح نیست.'],422); }
    $actionToken = otp_action_token();
    $pdo->prepare('UPDATE phone_verification_codes SET used_at = NOW(), verified_at = NOW(), verification_token_hash = ?, verification_token_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?')->execute([otp_token_hash($actionToken),(int)$row['id']]);
    $pdo->commit();
    otp_json(['success'=>true,'code'=>'OTP_VERIFIED','data'=>['purpose'=>$purpose,'verification_token'=>$actionToken,'expires_in'=>600]]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('OTP verify failure code=OTP_VERIFY_FAILED purpose=' . $purpose . ' phone=' . mask_iran_mobile((string)($mobile ?? '')));
    otp_json(['success'=>false,'code'=>'OTP_VERIFY_FAILED','message'=>'تأیید کد انجام نشد.'],500);
}
