<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/otp.php';
require_once __DIR__ . '/includes/registration_pin.php';

const AFARIEX_TERMS_VERSION = '1.0';
const AFARIEX_PRIVACY_VERSION = '1.0';

otp_cors();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') otp_json(['success'=>false,'code'=>'METHOD_NOT_ALLOWED'],405);

$input = otp_input();
$mobile = normalize_iran_mobile((string)($input['mobile'] ?? ''));
$fullName = trim((string)($input['full_name'] ?? ''));
$password = (string)($input['password'] ?? '');
$referralInput = strtoupper(trim((string)($input['referral_code'] ?? '')));
$registrationToken = trim((string)($input['registration_token'] ?? $input['verification_token'] ?? ''));
$consentValue = $input['consent'] ?? null;
$consentAccepted = $consentValue === true || $consentValue === 1 || $consentValue === '1' || $consentValue === 'true';
$securePassword = strlen($password) >= 8 && preg_match('/[a-z]/', $password) && preg_match('/[A-Z]/', $password) && preg_match('/\d/', $password);

if (!$consentAccepted) otp_json(['success'=>false,'code'=>'CONSENT_REQUIRED','message'=>'برای ادامه ثبتنام، ابتدا قوانین و سیاست حفظ حریم خصوصی را مطالعه و تأیید کنید.'],422);
if ($mobile === null) otp_json(['success'=>false,'code'=>'INVALID_MOBILE','message'=>'شماره موبایل معتبر نیست.'],422);
if ($fullName === '' || !$securePassword) otp_json(['success'=>false,'code'=>'INVALID_REGISTRATION_DATA','message'=>'اطلاعات ثبت‌نام معتبر نیست.'],422);
if ($registrationToken === '') otp_json(['success'=>false,'code'=>'REGISTRATION_OTP_REQUIRED','message'=>'تأیید شماره موبایل لازم است.'],422);

try {
    $pdo = db();
    $pdo->beginTransaction();
    $otp = $pdo->prepare('SELECT id FROM phone_verification_codes WHERE user_id IS NULL AND mobile = ? AND purpose = ? AND verification_token_hash = ? AND verification_token_expires_at > NOW() AND consumed_at IS NULL LIMIT 1 FOR UPDATE');
    $otp->execute([$mobile, 'registration', otp_token_hash($registrationToken)]);
    $challenge = $otp->fetch();
    if (!$challenge) { $pdo->rollBack(); otp_json(['success'=>false,'code'=>'REGISTRATION_OTP_INVALID','message'=>'تأیید ثبت‌نام معتبر یا فعال نیست.'],422); }

    $duplicate = $pdo->prepare('SELECT id FROM users WHERE mobile = ? LIMIT 1');
    $duplicate->execute([$mobile]);
    if ($duplicate->fetch()) { $pdo->rollBack(); otp_json(['success'=>false,'code'=>'MOBILE_ALREADY_REGISTERED','message'=>'این شماره موبایل قبلاً ثبت شده است.'],409); }

    $columns = $pdo->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN, 0);
    if (!in_array('pin_hash', $columns, true)) { $pdo->rollBack(); otp_json(['success'=>false,'code'=>'PIN_SYSTEM_UNAVAILABLE'],503); }
    $consentColumns = ['terms_accepted_at', 'terms_version', 'privacy_accepted_at', 'privacy_version'];
    if (array_diff($consentColumns, $columns)) { $pdo->rollBack(); otp_json(['success'=>false,'code'=>'CONSENT_STORAGE_UNAVAILABLE','message'=>'ثبت‌نام در حال حاضر امکان‌پذیر نیست.'],503); }

    $referrerId = null;
    if ($referralInput !== '') {
        if (!in_array('referral_code', $columns, true) || !in_array('referred_by_user_id', $columns, true)) {
            $pdo->rollBack(); otp_json(['success'=>false,'code'=>'INVALID_REFERRAL_CODE','message'=>'کد معرف معتبر نیست.'],422);
        }
        $referrer = $pdo->prepare('SELECT id FROM users WHERE referral_code = ? LIMIT 1');
        $referrer->execute([$referralInput]);
        $referrerId = $referrer->fetchColumn();
        if ($referrerId === false) { $pdo->rollBack(); otp_json(['success'=>false,'code'=>'INVALID_REFERRAL_CODE','message'=>'کد معرف معتبر نیست.'],422); }
    }

    $parts = preg_split('/\s+/u', $fullName, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $firstName = (string)($parts[0] ?? '');
    $lastName = implode(' ', array_slice($parts, 1));
    $generatedPin = registration_generate_pin();
    $apiToken = in_array('api_token', $columns, true) ? bin2hex(random_bytes(32)) : null;
    $fields = ['full_name','mobile','pin','pin_hash','password','role','created_at','first_name','last_name'];
    $values = [$fullName,$mobile,'',password_hash($generatedPin,PASSWORD_DEFAULT),password_hash($password,PASSWORD_DEFAULT),'user',date('Y-m-d H:i:s'),$firstName,$lastName];
    $acceptedAt = date('Y-m-d H:i:s');
    array_push($fields, 'terms_accepted_at', 'terms_version', 'privacy_accepted_at', 'privacy_version');
    array_push($values, $acceptedAt, AFARIEX_TERMS_VERSION, $acceptedAt, AFARIEX_PRIVACY_VERSION);
    if (in_array('referral_code', $columns, true)) { $fields[]='referral_code'; $values[] = strtoupper(bin2hex(random_bytes(5))); }
    if ($referrerId !== null) { $fields[]='referred_by_user_id'; $values[] = (int)$referrerId; }
    if ($apiToken !== null) { $fields[]='api_token'; $values[] = $apiToken; }

    $placeholders = implode(',', array_fill(0, count($fields), '?'));
    $stmt = $pdo->prepare('INSERT INTO users (' . implode(',', $fields) . ') VALUES (' . $placeholders . ')');
    $stmt->execute($values);
    $userId = (int)$pdo->lastInsertId();
    $pdo->prepare('UPDATE phone_verification_codes SET consumed_at = NOW() WHERE id = ?')->execute([(int)$challenge['id']]);
    $pdo->commit();

    otp_json(['success'=>true,'status'=>'success','code'=>'REGISTRATION_COMPLETED','data'=>[
        'id'=>$userId,
        'mobile'=>$mobile,
        'full_name'=>$fullName,
        'api_token'=>$apiToken,
        'pin'=>$generatedPin,
    ]]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Registration failure code=REGISTRATION_FAILED phone=' . mask_iran_mobile((string)($mobile ?? '')));
    otp_json(['success'=>false,'code'=>'REGISTRATION_FAILED','message'=>'ثبت‌نام انجام نشد.'],500);
}
