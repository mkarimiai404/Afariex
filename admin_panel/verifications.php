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
<div class="verification-table-wrap"><table class="verification-table"><thead><tr><th>کاربر</th><th>سطح فعلی</th><th>نوع</th><th>فایل‌ها</th><th>وضعیت</th><th>تاریخ</th><th class="verification-actions-heading">عملیات</th></tr></thead><tbody>
<?php foreach ($rows as $row): $rowLevel = normalize_verification_level((string)($row['level'] ?? 'bronze')); ?><tr><td><?= e(trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''))) ?><br><small dir="ltr"><?= e((string)$row['mobile']) ?></small></td><td><?= e((string)($definitions[$rowLevel]['title'] ?? $rowLevel)) ?></td><td><?= e((string)$row['request_type']) ?></td><td class="verification-files"><?php foreach (['identity_document_path' => 'مشاهده مدرک هویتی', 'selfie_path' => 'مشاهده تصویر سلفی', 'video_path' => 'مشاهده ویدیو'] as $field => $label): $mediaFile = verification_secure_media_path(__DIR__ . '/private_verifications', $row[$field] ?? null); if ($mediaFile !== null): ?><a class="btn btn-sm" target="_blank" rel="noopener" href="verification-media.php?request_id=<?= (int)$row['id'] ?>&field=<?= e($field) ?>"><?= $label ?></a><?php else: ?><span class="missing-media">مدرک بارگذاری نشده</span><?php endif; endforeach; ?></td><td><?= e((string)$row['status']) ?><br><small><?= e((string)($row['reviewed_at'] ?? '')) ?></small></td><td><?= e((string)$row['created_at']) ?></td><td class="verification-actions"><?php if ($row['status'] === 'pending'): ?><form method="post"><input type="hidden" name="csrf_token" value="<?= e($csrf) ?>"><input type="hidden" name="request_id" value="<?= (int)$row['id'] ?>"><input name="admin_note" placeholder="یادداشت یا دلیل رد" class="input"><div class="verification-action-buttons"><button name="decision" value="approved" class="btn btn-primary btn-sm">تأیید</button> <button name="decision" value="rejected" class="btn btn-danger btn-sm">رد</button></div></form><?php else: ?><?= e((string)($row['rejection_reason'] ?? $row['admin_note'] ?? '')) ?><?php endif; ?></td></tr><?php endforeach; ?></tbody></table></div></div>
<style>
.verification-table-wrap { overflow-x: auto; overflow-y: visible; max-width: 100%; border: 1px solid var(--line); border-radius: 12px; direction: rtl; -webkit-overflow-scrolling: touch; }
.verification-table { min-width: 1080px; direction: rtl; }
.verification-table th, .verification-table td { vertical-align: top; }
.verification-files { min-width: 270px; }
.verification-files .btn, .missing-media { display: inline-block; margin: 0 0 6px 4px; white-space: nowrap; }
.missing-media { color: #94a3b8; font-size: .85rem; }
.verification-actions-heading, .verification-actions { position: sticky; right: 0; z-index: 2; min-width: 245px; background: #fff; box-shadow: -4px 0 8px rgba(15, 23, 42, .08); }
.verification-actions-heading { z-index: 3; background: #f8fafc; }
.verification-actions form { min-width: 220px; }
.verification-action-buttons { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 7px; }
@media (max-width: 700px) { .verification-table { min-width: 940px; } .verification-actions-heading, .verification-actions { min-width: 215px; } }
</style>
<?php render_page_end();
