<?php
declare(strict_types=1);

require_once __DIR__ . '/layout.php';

require_login();
require_permission('view');

$perPage = 10;
$page = max(1, (int)($_GET['page'] ?? 1));
$offset = ($page - 1) * $perPage;

// دریافت نرخ فعال تبدیل افغانی به تومان
$activeRateRow = db()->query('SELECT rate FROM exchange_rates WHERE is_active = 1 ORDER BY id DESC LIMIT 1')->fetch();
$activeRate = $activeRateRow ? (float)$activeRateRow['rate'] : 0;

// دریافت لیست نمایندگی‌ها
$agencies = db()->query('SELECT name FROM agencies ORDER BY name ASC')->fetchAll(PDO::FETCH_COLUMN);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_fail($_POST['csrf_token'] ?? null);
    $action = $_POST['action'] ?? '';

    if ($action === 'create' || $action === 'update') {
        $mobile = trim($_POST['mobile'] ?? '');
        $agency = trim($_POST['agency'] ?? '');
        $sender = trim($_POST['sender'] ?? '');
        $receiver = trim($_POST['receiver'] ?? '');
        $amountToman = (float)($_POST['amount_toman'] ?? 0);
        $amountAfghani = (float)($_POST['amount_afghani'] ?? 0);
        $status = trim($_POST['status'] ?? 'pending');

        // پیدا کردن user_id از روی شماره موبایل
        $stmtUser = db()->prepare('SELECT id FROM users WHERE mobile = ?');
        $stmtUser->execute([$mobile]);
        $userId = (int)$stmtUser->fetchColumn();

        if ($userId <= 0) {
            flash('error', 'کاربری با این شماره موبایل یافت نشد.');
            header('Location: remittances.php?page=' . $page);
            exit;
        }

        if ($action === 'create') {
            require_permission('create');
            if ($agency === '' || $sender === '' || $receiver === '' || $amountToman <= 0 || $amountAfghani <= 0 || $status === '') {
                flash('error', 'لطفاً تمام فیلدهای ضروری را وارد کنید.');
            } else {
                $stmt = db()->prepare('INSERT INTO remittances (user_id, agency, sender, receiver, amount_toman, amount_afghani, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())');
                $stmt->execute([$userId, $agency, $sender, $receiver, $amountToman, $amountAfghani, $status]);
                log_activity('create', 'remittances', (int)db()->lastInsertId(), "ایجاد حواله برای کاربر {$mobile}");
                flash('success', 'حواله با موفقیت ثبت شد.');
            }
        } elseif ($action === 'update') {
            require_permission('edit');
            $id = (int)($_POST['id'] ?? 0);
            if ($id <= 0 || $agency === '' || $sender === '' || $receiver === '' || $amountToman <= 0 || $amountAfghani <= 0 || $status === '') {
                flash('error', 'اطلاعات ویرایش نامعتبر است.');
            } else {
                $stmt = db()->prepare('UPDATE remittances SET user_id = ?, agency = ?, sender = ?, receiver = ?, amount_toman = ?, amount_afghani = ?, status = ? WHERE id = ?');
                $stmt->execute([$userId, $agency, $sender, $receiver, $amountToman, $amountAfghani, $status, $id]);
                log_activity('update', 'remittances', $id, "ویرایش حواله #{$id}");
                flash('success', 'حواله با موفقیت ویرایش شد.');
            }
        }
        header('Location: remittances.php?page=' . $page);
        exit;
    }

    if ($action === 'delete') {
        require_permission('delete');
        $id = (int)($_POST['id'] ?? 0);
        if ($id > 0) {
            $stmt = db()->prepare('DELETE FROM remittances WHERE id = ?');
            $stmt->execute([$id]);
            log_activity('delete', 'remittances', $id, "حذف حواله #{$id}");
            flash('success', 'حواله حذف شد.');
        } else {
            flash('error', 'شناسه نامعتبر است.');
        }
        header('Location: remittances.php?page=' . $page);
        exit;
    }
}

$totalRows = (int)db()->query('SELECT COUNT(*) FROM remittances')->fetchColumn();
$totalPages = max(1, (int)ceil($totalRows / $perPage));

$stmt = db()->prepare('
    SELECT r.id, r.user_id, u.mobile, r.agency, r.sender, r.receiver, r.amount_toman, r.amount_afghani, r.status, r.created_at 
    FROM remittances r
    LEFT JOIN users u ON r.user_id = u.id
    ORDER BY r.id DESC 
    LIMIT :limit OFFSET :offset
');
$stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll();

$csrf = csrf_token();

function rm_status_class(string $status): string {
    return match ($status) {
        'pending' => 'status-pending',
        'approved' => 'status-approved',
        'rejected' => 'status-rejected',
        'paid' => 'status-paid',
        default => 'status-default',
    };
}

render_page_start('مدیریت حواله‌ها', 'remittances');
?>

<style>
    /* استایل‌های قبلی شما با کمی بهبود */
    :root {
        --rm-primary: #3b82f6; --rm-primary-hover: #2563eb; --rm-danger: #ef4444; --rm-danger-hover: #dc2626;
        --rm-surface: #ffffff; --rm-bg: #f8fafc; --rm-border: #e2e8f0; --rm-text: #0f172a; --rm-muted: #64748b;
        --rm-radius: 16px; --rm-shadow: 0 4px 20px rgba(15, 23, 42, 0.04); --rm-transition: all 0.3s ease;
    }
    .rm-container { display: flex; flex-direction: column; gap: 24px; font-family: inherit; }
    .rm-actions-header { display: flex; justify-content: space-between; align-items: center; background: var(--rm-surface); padding: 20px 24px; border-radius: var(--rm-radius); box-shadow: var(--rm-shadow); border: 1px solid var(--rm-border); }
    .rm-actions-header h3 { margin: 0; font-size: 20px; font-weight: 800; color: var(--rm-text); }
    .btn-toggle-add { background: var(--rm-primary); color: #fff; border: none; padding: 12px 20px; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 700; transition: var(--rm-transition); display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); }
    .btn-toggle-add:hover { background: var(--rm-primary-hover); transform: translateY(-2px); box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3); }
    .rm-panel { background: var(--rm-surface); border: 1px solid var(--rm-border); border-radius: var(--rm-radius); padding: 24px; box-shadow: var(--rm-shadow); }
    .rm-table-container { overflow-x: auto; margin: 0 -24px; padding: 0 24px; }
    .rm-table { width: 100%; min-width: 1000px; border-collapse: separate; border-spacing: 0; }
    .rm-table th { background: var(--rm-bg); color: #475569; font-size: 13px; font-weight: 800; padding: 16px; text-align: right; border-bottom: 2px solid var(--rm-border); white-space: nowrap; }
    .rm-table td { padding: 16px; border-bottom: 1px solid var(--rm-border); font-size: 14px; color: var(--rm-text); vertical-align: middle; transition: background 0.2s; }
    .rm-table tbody tr:hover td { background: #f8fafc; }
    .filter-row th { padding: 8px 16px; background: #f1f5f9; border-bottom: 2px solid var(--rm-border); }
    .rm-filter-input { width: 100%; height: 36px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 10px; font-size: 12px; outline: none; transition: var(--rm-transition); background: #fff; }
    .rm-filter-input:focus { border-color: var(--rm-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
    .rm-badge { display: inline-flex; align-items: center; justify-content: center; padding: 6px 12px; border-radius: 99px; font-size: 12px; font-weight: 800; white-space: nowrap; }
    .status-pending { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
    .status-approved { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .status-rejected { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .status-paid { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .status-default { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
    .rm-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .btn-edit { background: #eff6ff; color: #2563eb; border: none; height: 36px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; transition: var(--rm-transition); }
    .btn-edit:hover { background: #dbeafe; }
    .btn-delete { background: #fef2f2; color: var(--rm-danger); border: none; height: 36px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; transition: var(--rm-transition); }
    .btn-delete:hover { background: #fee2e2; color: var(--rm-danger-hover); }
    .rm-pagination { display: flex; justify-content: center; gap: 6px; margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--rm-border); }
    .page-link { min-width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; background: #f1f5f9; color: #475569; text-decoration: none; font-size: 14px; font-weight: 700; transition: var(--rm-transition); }
    .page-link:hover { background: #e2e8f0; color: #0f172a; }
    .page-link.active { background: var(--rm-primary); color: #fff; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); }
    .rm-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; opacity: 0; visibility: hidden; transition: var(--rm-transition); padding: 20px; }
    .rm-modal-overlay.active { opacity: 1; visibility: visible; }
    .rm-modal-content { background: var(--rm-surface); border-radius: var(--rm-radius); width: 100%; max-width: 800px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); transform: translateY(20px) scale(0.95); transition: var(--rm-transition); }
    .rm-modal-overlay.active .rm-modal-content { transform: translateY(0) scale(1); }
    .rm-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--rm-border); position: sticky; top: 0; background: var(--rm-surface); z-index: 10; }
    .rm-modal-header h4 { margin: 0; font-size: 18px; font-weight: 800; color: var(--rm-text); }
    .btn-close-modal { background: transparent; border: none; font-size: 24px; color: var(--rm-muted); cursor: pointer; transition: color 0.2s; line-height: 1; }
    .btn-close-modal:hover { color: var(--rm-danger); }
    .rm-modal-body { padding: 24px; }
    .rm-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .rm-field { display: flex; flex-direction: column; gap: 8px; }
    .rm-field label { font-size: 13px; font-weight: 700; color: #475569; }
    .rm-input, .rm-select { width: 100%; height: 44px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0 14px; font-size: 14px; font-family: inherit; background: var(--rm-bg); transition: var(--rm-transition); outline: none; box-sizing: border-box; }
    .rm-input:focus, .rm-select:focus { background: #fff; border-color: var(--rm-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
    .rm-field-full { grid-column: 1 / -1; }
    .btn-submit { background: var(--rm-primary); color: #fff; border: none; border-radius: 10px; height: 44px; padding: 0 24px; font-size: 14px; font-weight: 700; cursor: pointer; transition: var(--rm-transition); }
    .btn-submit:hover { background: var(--rm-primary-hover); }
    .persian-amount { font-size: 12px; color: var(--rm-primary); font-weight: 700; min-height: 18px; }
    .active-rate-info { font-size: 13px; color: var(--rm-muted); background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center; font-weight: bold; margin-bottom: 10px;}
</style>

<div class="rm-container">
    
    <div class="rm-actions-header">
        <h3>لیست حواله‌ها</h3>
        <?php if (can('create')): ?>
            <button class="btn-toggle-add" onclick="openModal('createRemittanceModal')">
                <span>+</span> افزودن حواله
            </button>
        <?php endif; ?>
    </div>

    <div class="rm-panel">
        <div class="rm-table-container">
            <table class="rm-table" id="remittancesTable">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>موبایل کاربر</th>
                        <th>نمایندگی</th>
                        <th>فرستنده</th>
                        <th>گیرنده</th>
                        <th>مبلغ (تومان)</th>
                        <th>مبلغ (افغانی)</th>
                        <th>وضعیت</th>
                        <th>تاریخ</th>
                        <th>عملیات</th>
                    </tr>
                    <tr class="filter-row">
                        <th><input class="rm-filter-input" data-col="0" placeholder="جستجو"></th>
                        <th><input class="rm-filter-input" data-col="1" placeholder="جستجو"></th>
                        <th><input class="rm-filter-input" data-col="2" placeholder="جستجو"></th>
                        <th><input class="rm-filter-input" data-col="3" placeholder="جستجو"></th>
                        <th><input class="rm-filter-input" data-col="4" placeholder="جستجو"></th>
                        <th><input class="rm-filter-input" data-col="5" placeholder="جستجو"></th>
                        <th><input class="rm-filter-input" data-col="6" placeholder="جستجو"></th>
                        <th><input class="rm-filter-input" data-col="7" placeholder="جستجو"></th>
                        <th><input class="rm-filter-input" data-col="8" placeholder="جستجو"></th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($rows)): ?>
                        <tr><td colspan="10" style="text-align: center; color: var(--rm-muted); padding: 32px;">هیچ حواله‌ای یافت نشد.</td></tr>
                    <?php else: ?>
                        <?php foreach ($rows as $row): ?>
                            <tr>
                                <td><strong><?= e((string)$row['id']) ?></strong></td>
                                <td dir="ltr" style="text-align: right;"><?= e((string)($row['mobile'] ?? 'نامشخص')) ?></td>
                                <td><?= e($row['agency']) ?></td>
                                <td><?= e($row['sender']) ?></td>
                                <td><?= e($row['receiver']) ?></td>
                                <td><strong><?= number_format((float)$row['amount_toman']) ?></strong></td>
                                <td><strong><?= number_format((float)$row['amount_afghani']) ?></strong></td>
                                <td>
                                    <span class="rm-badge <?= rm_status_class((string)$row['status']) ?>">
                                        <?= e(status_fa((string)$row['status'])) ?>
                                    </span>
                                </td>
                                <td dir="ltr" style="text-align: right;"><?= e(to_jalali_datetime((string)$row['created_at'])) ?></td>
                                <td>
                                    <div class="rm-actions">
                                        <?php if (can('edit')): ?>
                                            <button class="btn-edit" 
                                                    data-id="<?= e((string)$row['id']) ?>" 
                                                    data-mobile="<?= e((string)$row['mobile']) ?>" 
                                                    data-agency="<?= e($row['agency']) ?>"
                                                    data-sender="<?= e($row['sender']) ?>" 
                                                    data-receiver="<?= e($row['receiver']) ?>"
                                                    data-amount_toman="<?= e((string)$row['amount_toman']) ?>" 
                                                    data-amount_afghani="<?= e((string)$row['amount_afghani']) ?>"
                                                    data-status="<?= e($row['status']) ?>" 
                                                    onclick="prepareEditModal(this)">ویرایش</button>
                                        <?php endif; ?>
                                        
                                        <?php if (can('delete')): ?>
                                            <form method="post" style="margin:0;" onsubmit="return confirm('آیا از حذف این حواله اطمینان دارید؟');">
                                                <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
                                                <input type="hidden" name="action" value="delete">
                                                <input type="hidden" name="id" value="<?= e((string)$row['id']) ?>">
                                                <button class="btn-delete" type="submit">حذف</button>
                                            </form>
                                        <?php endif; ?>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

        <?php if ($totalPages > 1): ?>
            <div class="rm-pagination">
                <?php for ($i = 1; $i <= $totalPages; $i++): ?>
                    <a class="page-link <?= $i === $page ? 'active' : '' ?>" href="remittances.php?page=<?= $i ?>"><?= $i ?></a>
                <?php endfor; ?>
            </div>
        <?php endif; ?>
    </div>
</div>

<!-- مدال افزودن حواله -->
<?php if (can('create')): ?>
<div class="rm-modal-overlay" id="createRemittanceModal">
    <div class="rm-modal-content">
        <div class="rm-modal-header">
            <h4>افزودن حواله جدید</h4>
            <button class="btn-close-modal" onclick="closeModal('createRemittanceModal')">&times;</button>
        </div>
        <div class="rm-modal-body">
            <div class="active-rate-info">
                نرخ ارز فعال (افغانی به تومان): <?= number_format($activeRate, 2) ?>
            </div>
            <form method="post" class="rm-form-grid">
                <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
                <input type="hidden" name="action" value="create">
                
                <div class="rm-field">
                    <label>شماره موبایل کاربر</label>
                    <input class="rm-input" type="text" dir="ltr" name="mobile" required>
                </div>
                <div class="rm-field">
                    <label>نمایندگی</label>
                    <select class="rm-select" name="agency" required>
                        <option value="">انتخاب کنید...</option>
                        <?php foreach($agencies as $agc): ?>
                            <option value="<?= e($agc) ?>"><?= e($agc) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="rm-field">
                    <label>وضعیت</label>
                    <select class="rm-select" name="status">
                        <option value="pending">در انتظار</option>
                        <option value="approved">تایید شده</option>
                        <option value="rejected">رد شده</option>
                        <option value="paid">پرداخت شده</option>
                    </select>
                </div>
                <div class="rm-field"></div> <!-- برای تعادل در گرید -->

                <div class="rm-field">
                    <label>فرستنده</label>
                    <input class="rm-input" name="sender" required>
                </div>
                <div class="rm-field">
                    <label>گیرنده</label>
                    <input class="rm-input" name="receiver" required>
                </div>
                
                <div class="rm-field">
                    <label>مبلغ (تومان)</label>
                    <input class="rm-input amount-toman" type="number" step="0.01" min="0" dir="ltr" name="amount_toman" required>
                    <div class="persian-amount toman-word"></div>
                </div>
                <div class="rm-field">
                    <label>مبلغ (افغانی)</label>
                    <input class="rm-input amount-afghani" type="number" step="0.01" min="0" dir="ltr" name="amount_afghani" required>
                </div>
                
                <div class="rm-field rm-field-full" style="margin-top: 16px; align-items: flex-end;">
                    <button type="submit" class="btn-submit">ثبت حواله</button>
                </div>
            </form>
        </div>
    </div>
</div>
<?php endif; ?>

<!-- مدال ویرایش حواله -->
<?php if (can('edit')): ?>
<div class="rm-modal-overlay" id="editRemittanceModal">
    <div class="rm-modal-content">
        <div class="rm-modal-header">
            <h4>ویرایش حواله</h4>
            <button class="btn-close-modal" onclick="closeModal('editRemittanceModal')">&times;</button>
        </div>
        <div class="rm-modal-body">
             <div class="active-rate-info">
                نرخ ارز فعال (افغانی به تومان): <?= number_format($activeRate, 2) ?>
            </div>
            <form method="post" class="rm-form-grid">
                <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
                <input type="hidden" name="action" value="update">
                <input type="hidden" name="id" id="editRemittanceId">
                
                <div class="rm-field">
                    <label>شماره موبایل کاربر</label>
                    <input class="rm-input" type="text" dir="ltr" id="editRemittanceMobile" name="mobile" required>
                </div>
                <div class="rm-field">
                    <label>نمایندگی</label>
                    <select class="rm-select" id="editRemittanceAgency" name="agency" required>
                        <option value="">انتخاب کنید...</option>
                        <?php foreach($agencies as $agc): ?>
                            <option value="<?= e($agc) ?>"><?= e($agc) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="rm-field">
                    <label>وضعیت</label>
                    <select class="rm-select" id="editRemittanceStatus" name="status">
                        <option value="pending">در انتظار</option>
                        <option value="approved">تایید شده</option>
                        <option value="rejected">رد شده</option>
                        <option value="paid">پرداخت شده</option>
                    </select>
                </div>
                <div class="rm-field"></div> <!-- برای تعادل در گرید -->

                <div class="rm-field">
                    <label>فرستنده</label>
                    <input class="rm-input" id="editRemittanceSender" name="sender" required>
                </div>
                <div class="rm-field">
                    <label>گیرنده</label>
                    <input class="rm-input" id="editRemittanceReceiver" name="receiver" required>
                </div>
                <div class="rm-field">
                    <label>مبلغ (تومان)</label>
                    <input class="rm-input amount-toman" type="number" step="0.01" min="0" dir="ltr" id="editRemittanceToman" name="amount_toman" required>
                    <div class="persian-amount toman-word"></div>
                </div>
                <div class="rm-field">
                    <label>مبلغ (افغانی)</label>
                    <input class="rm-input amount-afghani" type="number" step="0.01" min="0" dir="ltr" id="editRemittanceAfghani" name="amount_afghani" required>
                </div>
                
                <div class="rm-field rm-field-full" style="margin-top: 16px; align-items: flex-end;">
                    <button type="submit" class="btn-submit">ذخیره تغییرات</button>
                </div>
            </form>
        </div>
    </div>
</div>
<?php endif; ?>

<!-- اسکریپت تبدیل عدد به حروف -->
<script src="https://cdn.jsdelivr.net/gh/saeedalipoor/numero@1.0.1/dist/numero.min.js"></script>

<script>
    const ACTIVE_RATE = <?= $activeRate ?>;

    // توابع تبدیل ارز
    document.querySelectorAll('.amount-toman').forEach(input => {
        input.addEventListener('input', function() {
            const valToman = parseFloat(this.value) || 0;
            // پیدا کردن فیلد افغانی در همان فرم
            const afgInput = this.closest('form').querySelector('.amount-afghani');
            if(ACTIVE_RATE > 0 && afgInput) {
                afgInput.value = (valToman / ACTIVE_RATE).toFixed(2);
            }
            
            // نمایش به حروف
            const wordDiv = this.parentElement.querySelector('.toman-word');
            if(wordDiv && typeof Numero !== 'undefined') {
                wordDiv.innerText = valToman > 0 ? Numero.numberToWords(valToman) + ' تومان' : '';
            }
        });
    });

    document.querySelectorAll('.amount-afghani').forEach(input => {
        input.addEventListener('input', function() {
            const valAfg = parseFloat(this.value) || 0;
            // پیدا کردن فیلد تومان در همان فرم
            const tomanInput = this.closest('form').querySelector('.amount-toman');
            if(ACTIVE_RATE > 0 && tomanInput) {
                const computedToman = Math.round(valAfg * ACTIVE_RATE);
                tomanInput.value = computedToman;
                
                // بروزرسانی حروف
                const wordDiv = tomanInput.parentElement.querySelector('.toman-word');
                if(wordDiv && typeof Numero !== 'undefined') {
                    wordDiv.innerText = computedToman > 0 ? Numero.numberToWords(computedToman) + ' تومان' : '';
                }
            }
        });
    });

    // مدیریت مدال‌ها
    function openModal(id) {
        document.getElementById(id).classList.add('active');
    }

    function closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }

    window.onclick = function(event) {
        if (event.target.classList.contains('rm-modal-overlay')) {
            event.target.classList.remove('active');
        }
    }

    function prepareEditModal(btn) {
        document.getElementById('editRemittanceId').value = btn.dataset.id || '';
        document.getElementById('editRemittanceMobile').value = btn.dataset.mobile || '';
        document.getElementById('editRemittanceAgency').value = btn.dataset.agency || '';
        document.getElementById('editRemittanceSender').value = btn.dataset.sender || '';
        document.getElementById('editRemittanceReceiver').value = btn.dataset.receiver || '';
        document.getElementById('editRemittanceToman').value = btn.dataset.amount_toman || '';
        document.getElementById('editRemittanceAfghani').value = btn.dataset.amount_afghani || '';
        document.getElementById('editRemittanceStatus').value = btn.dataset.status || 'pending';
        
        // تریگر کردن ایونت برای نمایش عدد به حروف هنگام لود ویرایش
        const event = new Event('input');
        document.getElementById('editRemittanceToman').dispatchEvent(event);

        openModal('editRemittanceModal');
    }

    // فیلتر جدول
    (function () {
        const table = document.getElementById('remittancesTable');
        if (!table) return;
        const filters = table.querySelectorAll('.filter-row input');
        const rows = Array.from(table.querySelectorAll('tbody tr:not(.filter-row)'));
        
        function applyFilters() {
            rows.forEach((row) => {
                if(row.cells.length === 1) return; 
                let visible = true;
                filters.forEach((input) => {
                    const col = Number(input.dataset.col);
                    const text = (row.cells[col]?.innerText || '').toLowerCase();
                    const value = input.value.trim().toLowerCase();
                    if (value && !text.includes(value)) visible = false;
                });
                row.style.display = visible ? '' : 'none';
            });
        }
        filters.forEach((input) => input.addEventListener('input', applyFilters));
    })();
</script>

<?php render_page_end(); ?>
