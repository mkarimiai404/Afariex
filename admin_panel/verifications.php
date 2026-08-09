<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/layout.php';
require_once __DIR__ . '/verification_service.php';
require_login();
require_permission('view');
ensure_verification_schema();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_permission('edit');
    verify_csrf_or_fail($_POST['csrf_token'] ?? null);
    $requestId = (int)($_POST['request_id'] ?? 0);
    $decision = trim((string)($_POST['decision'] ?? ''));
    $note = trim((string)($_POST['admin_note'] ?? ''));
    try {
        review_verification_request(db(), $requestId, $decision, $note, (int)$_SESSION['admin_id'], __DIR__ . '/private_verifications');
        flash('success', $decision === 'approved' ? 'درخواست با موفقیت تأیید شد.' : 'درخواست رد شد.');
    } catch (Throwable $e) { flash('error', $e->getMessage()); }
    header('Location: verifications.php'); exit;
}

$status = trim((string)($_GET['status'] ?? 'pending'));
$where = $status === 'all' ? '' : " WHERE r.status = '" . (in_array($status, ['pending', 'approved', 'rejected'], true) ? $status : 'pending') . "'";
$rows = db()->query("SELECT r.*, u.mobile, u.first_name, u.last_name, v.level FROM verification_upgrade_requests r INNER JOIN users u ON u.id = r.user_id LEFT JOIN user_verification_levels v ON v.user_id = r.user_id {$where} ORDER BY r.id DESC")->fetchAll();
$csrf = csrf_token();
$definitions = verification_level_definitions();
render_page_start('مدیریت احراز هویت', 'verifications');
?>
<?php if (($definitions['gold']['daily_limit'] ?? null) === null): ?><div class="card" style="color:#92400e;background:#fffbeb">سقف روزانه سطح طلایی هنوز تنظیم نشده است. مقدار GOLD_DAILY_LIMIT_TOMAN را در تنظیمات سرور تنظیم کنید.</div><?php endif; ?>
<div class="card"><div class="actions" style="justify-content:space-between"><h3 style="margin:0">درخواست‌های احراز هویت</h3><div><a class="btn btn-sm" href="verifications.php?status=pending">در انتظار</a> <a class="btn btn-sm" href="verifications.php?status=all">همه</a></div></div>
<div class="table-wrap"><table><thead><tr><th>کاربر</th><th>سطح فعلی</th><th>نوع</th><th>فایل‌ها</th><th>وضعیت</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>
<?php foreach ($rows as $row): $rowLevel = normalize_verification_level((string)($row['level'] ?? 'bronze')); ?><tr><td><?= e(trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''))) ?><br><small dir="ltr"><?= e((string)$row['mobile']) ?></small></td><td><?= e((string)($definitions[$rowLevel]['title'] ?? $rowLevel)) ?></td><td><?= e((string)$row['request_type']) ?></td><td><?php foreach (['identity_document_path' => 'مدرک', 'selfie_path' => 'سلفی', 'video_path' => 'ویدیو'] as $field => $label): if ((string)($row[$field] ?? '') !== ''): ?><a class="btn btn-sm" target="_blank" href="verification-media.php?request_id=<?= (int)$row['id'] ?>&field=<?= e($field) ?>"><?= $label ?></a><?php endif; endforeach; ?></td><td><?= e((string)$row['status']) ?><br><small><?= e((string)($row['reviewed_at'] ?? '')) ?></small></td><td><?= e((string)$row['created_at']) ?></td><td><?php if ($row['status'] === 'pending'): ?><form method="post"><input type="hidden" name="csrf_token" value="<?= e($csrf) ?>"><input type="hidden" name="request_id" value="<?= (int)$row['id'] ?>"><input name="admin_note" placeholder="یادداشت یا دلیل رد" class="input"><button name="decision" value="approved" class="btn btn-primary btn-sm">تأیید</button> <button name="decision" value="rejected" class="btn btn-danger btn-sm">رد</button></form><?php else: ?><?= e((string)($row['rejection_reason'] ?? $row['admin_note'] ?? '')) ?><?php endif; ?></td></tr><?php endforeach; ?></tbody></table></div></div>
<?php render_page_end();
