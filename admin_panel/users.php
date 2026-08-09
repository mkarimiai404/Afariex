<?php
declare(strict_types=1);
require_once __DIR__ . '/layout.php';
require_once __DIR__ . '/balance_view_helpers.php';
require_login();
require_permission('view');

$perPage = 10;
$page = max(1, (int)($_GET['page'] ?? 1));
$offset = ($page - 1) * $perPage;
$startDate = trim((string)($_GET['start_date'] ?? ''));
$endDate = trim((string)($_GET['end_date'] ?? ''));
$exportExcel = (string)($_GET['export'] ?? '') === 'excel';
$exportPrint = (string)($_GET['export'] ?? '') === 'print';
ensure_verification_schema();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_fail($_POST['csrf_token'] ?? null);
    $action = $_POST['action'] ?? '';

    if ($action === 'manual_operation') {
        require_permission('edit');

        $userId = (int)($_POST['user_id'] ?? 0);
        $manualAction = trim((string)($_POST['manual_action'] ?? ''));
        $amountInput = trim((string)($_POST['amount'] ?? ''));
        $agency = trim((string)($_POST['agency'] ?? ''));
        $sender = trim((string)($_POST['sender'] ?? ''));
        $receiver = trim((string)($_POST['receiver'] ?? ''));
        $amountAfghaniInput = trim((string)($_POST['amount_afghani'] ?? ''));

        $allowedActions = ['increase', 'decrease', 'remittance'];

        $isValidAmount = static function (string $value): bool {
            return preg_match('/^(?:0|[1-9]\d*)(?:\.\d+)?$/', $value) === 1 && (float)$value > 0;
        };

        if ($userId <= 0 || !in_array($manualAction, $allowedActions, true) || !$isValidAmount($amountInput)) {
            flash('error', 'عملیات یا مبلغ وارد شده نامعتبر است.');
            header('Location: users.php?page=' . $page);
            exit;
        }

        if ($manualAction === 'remittance' && ($agency === '' || $sender === '' || $receiver === '' || !$isValidAmount($amountAfghaniInput))) {
            flash('error', 'برای ثبت حواله، فیلدهای نمایندگی، فرستنده و گیرنده اجباری هستند.');
            header('Location: users.php?page=' . $page);
            exit;
        }

        $operationNonce = trim((string)($_POST['operation_nonce'] ?? ''));
        if ($operationNonce === '' || !hash_equals((string)($_SESSION['manual_operation_nonce'] ?? ''), $operationNonce)) {
            flash('error', 'Invalid or already processed operation.');
            header('Location: users.php?page=' . $page);
            exit;
        }

        db()->beginTransaction();
        try {
            $userStmt = db()->prepare('SELECT id, mobile, balance FROM users WHERE id = ? FOR UPDATE');
            $userStmt->execute([$userId]);
            $userRow = $userStmt->fetch();

            if (!$userRow) {
                db()->rollBack();
                flash('error', 'کاربر مورد نظر یافت نشد.');
                header('Location: users.php?page=' . $page);
                exit;
            }

            $userBalance = (string)($userRow['balance'] ?? '0');
            $mobile = (string)($userRow['mobile'] ?? '');
            $verification = verification_state($userId, true);

            if ($manualAction === 'decrease' && $verification['withdrawal_limit'] !== null && (float)$amountInput > (float)$verification['withdrawal_limit']) {
                db()->rollBack();
                flash('error', 'سقف برداشت سطح فعلی کاربر ۵,۰۰۰,۰۰۰ تومان است.');
                header('Location: users.php?page=' . $page);
                exit;
            }

            $sufficientBalance = true;
            if (in_array($manualAction, ['decrease', 'remittance'], true)) {
                $sufficientStmt = db()->prepare('SELECT id FROM users WHERE id = ? AND balance >= ?');
                $sufficientStmt->execute([$userId, $amountInput]);
                $sufficientBalance = (bool)$sufficientStmt->fetchColumn();
            }
            if (!$sufficientBalance) {
                db()->rollBack();
                flash('error', 'موجودی کاربر برای این برداشت کافی نیست.');
                header('Location: users.php?page=' . $page);
                exit;
            }

            if ($manualAction === 'increase') {
                $updateStmt = db()->prepare('UPDATE users SET balance = balance + ? WHERE id = ?');
                $updateStmt->execute([$amountInput, $userId]);
                $transactionType = 'deposit';
            } elseif ($manualAction === 'decrease') {
                $updateStmt = db()->prepare('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?');
                $updateStmt->execute([$amountInput, $userId, $amountInput]);
                if ($updateStmt->rowCount() !== 1) {
                    throw new RuntimeException('Insufficient wallet balance.');
                }
                $transactionType = 'withdrawal';
            } else {
                $updateStmt = db()->prepare('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?');
                $updateStmt->execute([$amountInput, $userId, $amountInput]);
                if ($updateStmt->rowCount() !== 1) {
                    throw new RuntimeException('Insufficient wallet balance.');
                }
                $transactionType = 'remittance';
            }

            $balanceStmt = db()->prepare('SELECT balance FROM users WHERE id = ?');
            $balanceStmt->execute([$userId]);
            $balanceAfter = (string)$balanceStmt->fetchColumn();

            if ($manualAction === 'remittance') {
                $remittanceColumns = db()->query('SHOW COLUMNS FROM remittances')
                    ->fetchAll(PDO::FETCH_COLUMN, 0);

                $remittanceData = [
                    'user_id' => $userId,
                    'agency' => $agency,
                    'sender' => $sender,
                    'receiver' => $receiver,
                    'amount_toman' => $amount,
                    'status' => 'approved',
                ];

                if (in_array('amount_afghani', $remittanceColumns, true)) {
                    $remittanceData['amount_afghani'] = $amountAfghaniInput;
                }
                if (in_array('created_at', $remittanceColumns, true)) {
                    $remittanceData['created_at'] = date('Y-m-d H:i:s');
                }

                if (!in_array('user_id', $remittanceColumns, true) || !in_array('amount_toman', $remittanceColumns, true)) {
                    db()->rollBack();
                    flash('error', 'ساختار جدول حواله‌ها با این عملیات سازگار نیست.');
                    header('Location: users.php?page=' . $page);
                    exit;
                }

                $remittanceFields = array_keys($remittanceData);
                $remittancePlaceholders = array_fill(0, count($remittanceFields), '?');
                $remittanceSql = 'INSERT INTO remittances (' . implode(', ', $remittanceFields) . ') VALUES (' . implode(', ', $remittancePlaceholders) . ')';
                $remittanceStmt = db()->prepare($remittanceSql);
                $remittanceStmt->execute(array_values($remittanceData));
            }

            $transactionColumns = db()->query('SHOW COLUMNS FROM transactions')
                ->fetchAll(PDO::FETCH_COLUMN, 0);

            $transactionData = [
                'user_id' => $userId,
                'amount' => $amountInput,
                'type' => $transactionType,
                'status' => 'approved',
            ];
            if (in_array('description', $transactionColumns, true)) {
                $transactionData['description'] = $manualAction === 'remittance'
                    ? "Remittance {$agency} / {$sender} / {$receiver}"
                    : "Manual operation {$manualAction}";
            }

            if (in_array('balance_applied', $transactionColumns, true)) {
                $transactionData['balance_applied'] = 1;
            }
            if (in_array('created_at', $transactionColumns, true)) {
                $transactionData['created_at'] = date('Y-m-d H:i:s');
            }
            if (in_array('balance_before', $transactionColumns, true)) {
                $transactionData['balance_before'] = $userBalance;
            }
            if (in_array('balance_after', $transactionColumns, true)) {
                $transactionData['balance_after'] = $balanceAfter;
            }
            if (in_array('operator_id', $transactionColumns, true)) {
                $transactionData['operator_id'] = (int)($_SESSION['admin_id'] ?? 0);
            } elseif (in_array('admin_id', $transactionColumns, true)) {
                $transactionData['admin_id'] = (int)($_SESSION['admin_id'] ?? 0);
            }

            if (!in_array('user_id', $transactionColumns, true) || !in_array('amount', $transactionColumns, true) || !in_array('type', $transactionColumns, true) || !in_array('status', $transactionColumns, true)) {
                db()->rollBack();
                flash('error', 'ساختار جدول تراکنش‌ها با این عملیات سازگار نیست.');
                header('Location: users.php?page=' . $page);
                exit;
            }

            $transactionFields = array_keys($transactionData);
            $transactionPlaceholders = array_fill(0, count($transactionFields), '?');
            $transactionSql = 'INSERT INTO transactions (' . implode(', ', $transactionFields) . ') VALUES (' . implode(', ', $transactionPlaceholders) . ')';
            $transactionStmt = db()->prepare($transactionSql);
            $transactionStmt->execute(array_values($transactionData));

            log_activity(
                'manual_operation',
                'users',
                $userId,
                "عملیات دستی {$manualAction} برای کاربر {$mobile} به مبلغ {$amountInput}"
            );
            db()->commit();
            unset($_SESSION['manual_operation_nonce']);
            flash('success', 'عملیات دستی با موفقیت انجام شد.');
        } catch (Throwable $e) {
            if (db()->inTransaction()) {
                db()->rollBack();
            }
            flash('error', $e->getMessage() === 'Insufficient wallet balance.'
                ? 'Insufficient wallet balance.'
                : 'Operation failed; all changes were rolled back.');
        }

        header('Location: users.php?page=' . $page);
        exit;
    }

    if ($action === 'create') {
        require_permission('create');
        $mobile = trim($_POST['mobile'] ?? '');
        $firstName = trim($_POST['first_name'] ?? '');
        $lastName = trim($_POST['last_name'] ?? '');
        $pinCode = trim($_POST['pin_code'] ?? '');
        $password = trim($_POST['password'] ?? '');
        $role = trim($_POST['role'] ?? 'viewer');
        if (!preg_match('/^\d{4}$/', $pinCode)) {
            flash('error', 'پین کد باید دقیقاً ۴ رقم عددی باشد.');
        } elseif ($mobile === '' || $password === '' || !in_array($role, ['admin', 'editor', 'viewer'], true)) {
            flash('error', 'اطلاعات کاربر جدید نامعتبر است.');
        } else {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = db()->prepare('INSERT INTO users (mobile, first_name, last_name, pin_code, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())');
            $stmt->execute([$mobile, $firstName, $lastName, $pinCode, $hash, $role]);
            $newId = (int)db()->lastInsertId();
            log_activity('create', 'users', $newId, "ایجاد کاربر: {$mobile}");
            flash('success', 'کاربر جدید ثبت شد.');
        }
        header('Location: users.php?page=' . $page);
        exit;
    }

    if ($action === 'update') {
        require_permission('edit');
        $id = (int)($_POST['id'] ?? 0);
        $mobile = trim($_POST['mobile'] ?? '');
        $firstName = trim($_POST['first_name'] ?? '');
        $lastName = trim($_POST['last_name'] ?? '');
        $pinCode = trim($_POST['pin_code'] ?? '');
        $role = trim($_POST['role'] ?? 'viewer');
        $newPassword = trim($_POST['new_password'] ?? '');
        if (!preg_match('/^\d{4}$/', $pinCode)) {
            flash('error', 'پین کد باید دقیقاً ۴ رقم عددی باشد.');
        } elseif ($id <= 0 || $mobile === '' || !in_array($role, ['admin', 'editor', 'viewer'], true)) {
            flash('error', 'اطلاعات ویرایش کاربر نامعتبر است.');
        } else {
            if ($newPassword !== '') {
                $hash = password_hash($newPassword, PASSWORD_DEFAULT);
                $stmt = db()->prepare('UPDATE users SET mobile = ?, first_name = ?, last_name = ?, pin_code = ?, role = ?, password = ? WHERE id = ?');
                $stmt->execute([$mobile, $firstName, $lastName, $pinCode, $role, $hash, $id]);
            } else {
                $stmt = db()->prepare('UPDATE users SET mobile = ?, first_name = ?, last_name = ?, pin_code = ?, role = ? WHERE id = ?');
                $stmt->execute([$mobile, $firstName, $lastName, $pinCode, $role, $id]);
            }
            log_activity('update', 'users', $id, "ویرایش کاربر: {$mobile}");
            flash('success', 'کاربر ویرایش شد.');
        }
        header('Location: users.php?page=' . $page);
        exit;
    }

    if ($action === 'delete') {
        require_permission('delete');
        $id = (int)($_POST['id'] ?? 0);
        if ($id > 0) {
            if ($id === (int)($_SESSION['admin_id'] ?? 0)) {
                flash('error', 'امکان حذف حساب کاربری فعلی وجود ندارد.');
            } else {
                $stmt = db()->prepare('DELETE FROM users WHERE id = ?');
                $stmt->execute([$id]);
                log_activity('delete', 'users', $id, "حذف کاربر #{$id}");
                flash('success', 'کاربر حذف شد.');
            }
        } else {
            flash('error', 'شناسه کاربر نامعتبر است.');
        }
        header('Location: users.php?page=' . $page);
        exit;
    }
}

$where = [];
$params = [];

if ($startDate !== '') {
    $startDateSql = jalali_input_to_gregorian_datetime($startDate, false);
    if ($startDateSql) {
        $where[] = 'created_at >= ?';
        $params[] = $startDateSql;
    }
}

if ($endDate !== '') {
    $endDateSql = jalali_input_to_gregorian_datetime($endDate, true);
    if ($endDateSql) {
        $where[] = 'created_at <= ?';
        $params[] = $endDateSql;
    }
}

$whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

$countStmt = db()->prepare("SELECT COUNT(*) FROM users {$whereSql}");
$countStmt->execute($params);
$totalRows = (int)$countStmt->fetchColumn();
$totalPages = max(1, (int)ceil($totalRows / $perPage));
$limit = (int)$perPage;
$offset = (int)$offset;

$stmt = db()->prepare("SELECT id, mobile, first_name, last_name, balance, pin_code, role, created_at FROM users {$whereSql} ORDER BY id DESC LIMIT {$limit} OFFSET {$offset}");
$stmt->execute($params);
$rows = $stmt->fetchAll();
foreach ($rows as &$userRow) {
    $userRow['verification'] = verification_state((int)$userRow['id']);
    $pendingRequestStmt = db()->prepare("SELECT id, status FROM verification_upgrade_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1");
    $pendingRequestStmt->execute([(int)$userRow['id']]);
    $userRow['upgrade_request'] = $pendingRequestStmt->fetch() ?: null;
}
unset($userRow);
$pendingUpgradeStmt = db()->query("SELECT r.id, r.user_id, r.created_at, u.mobile, u.first_name, u.last_name, v.level FROM verification_upgrade_requests r INNER JOIN users u ON u.id = r.user_id LEFT JOIN user_verification_levels v ON v.user_id = r.user_id WHERE r.status = 'pending' ORDER BY r.id ASC");
$pendingUpgrades = $pendingUpgradeStmt->fetchAll();

if ($exportExcel) {
    $exportStmt = db()->prepare("SELECT id, mobile, first_name, last_name, balance, pin_code, role, created_at FROM users {$whereSql} ORDER BY id DESC");
    $exportStmt->execute($params);
    $exportRows = [];
    while ($row = $exportStmt->fetch()) {
        $exportRows[] = [
            '#' . (string)$row['id'],
            (string)$row['mobile'],
            trim((string)($row['first_name'] ?? '') . ' ' . (string)($row['last_name'] ?? '')),
            admin_balance_with_unit($row['balance'] ?? null),
            (string)($row['pin_code'] ?? '-'),
            (string)($row['role'] ?? ''),
            to_jalali_datetime((string)$row['created_at']),
        ];
    }

    export_xls_table(
        'Users_Report_' . date('Ymd_His') . '.xls',
        ['شناسه', 'شماره موبایل', 'نام کامل', 'موجودی', 'پین کد', 'نقش', 'تاریخ ایجاد'],
        $exportRows
    );
}

if ($exportPrint) {
    $printStmt = db()->prepare("SELECT id, mobile, first_name, last_name, balance, pin_code, role, created_at FROM users {$whereSql} ORDER BY id DESC");
    $printStmt->execute($params);
    $printRows = [];
    while ($row = $printStmt->fetch()) {
        $printRows[] = [
            '#' . (string)$row['id'],
            (string)$row['mobile'],
            trim((string)($row['first_name'] ?? '') . ' ' . (string)($row['last_name'] ?? '')),
            admin_balance_with_unit($row['balance'] ?? null),
            (string)($row['pin_code'] ?? '-'),
            (string)($row['role'] ?? ''),
            to_jalali_datetime((string)$row['created_at']),
        ];
    }

    render_print_table_view(
        'گزارش کاربران',
        ['شناسه', 'شماره موبایل', 'نام کامل', 'موجودی', 'پین کد', 'نقش', 'تاریخ ایجاد'],
        $printRows,
        'فیلتر بازه تاریخ اعمال شده است.'
    );
}

$csrf = csrf_token();
if (empty($_SESSION['manual_operation_nonce'])) {
    $_SESSION['manual_operation_nonce'] = bin2hex(random_bytes(16));
}
$manualOperationNonce = (string)$_SESSION['manual_operation_nonce'];

render_page_start('مدیریت کاربران', 'users');
?>
<style>
  .datepicker-plot-area, .pwt-datepicker, .datepicker-container { z-index: 99999 !important; }
  .users-filter-shell { overflow: visible !important; position: relative; }
  .users-table-filter {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #dbe4ef;
    border-radius: 12px;
    font-family: inherit;
    font-size: 13px;
    color: #0f172a;
    background: #fff;
    outline: none;
    box-sizing: border-box;
  }
  .users-table-filter:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.10);
  }
  .users-row-actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: nowrap;
    white-space: nowrap;
  }
  .users-row-actions form {
    margin: 0;
    padding: 0;
    display: inline-block;
  }
  .admin-balance-badge { display:inline-flex;align-items:center;justify-content:center;padding:7px 11px;border-radius:10px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-weight:800;white-space:nowrap;direction:rtl; }
  .admin-balance-panel { padding:14px 16px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font-weight:800;text-align:right; }
  @media (max-width: 840px) { .admin-balance-badge { width:100%;box-sizing:border-box; } }
</style>
<?php if ($pendingUpgrades !== []): ?>
<div class="card">
  <h3 style="margin-top:0;">درخواست‌های ارتقاء سطح کاربری</h3>
  <p><a class="btn btn-primary btn-sm" href="verifications.php">مشاهده مدارک و بررسی امن درخواست‌ها</a></p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>کاربر</th><th>موبایل</th><th>سطح فعلی</th><th>سقف برداشت</th><th>عملیات</th></tr></thead>
      <tbody>
      <?php foreach ($pendingUpgrades as $upgrade): $upgradeState = verification_state((int)$upgrade['user_id']); ?>
        <tr>
          <td><?= e(trim(($upgrade['first_name'] ?? '') . ' ' . ($upgrade['last_name'] ?? ''))) ?></td>
          <td dir="ltr"><?= e((string)$upgrade['mobile']) ?></td>
          <td><?= e((string)$upgradeState['level']) ?> / تلفن <?= $upgradeState['phone_verified'] ? 'تأییدشده' : 'تأییدنشده' ?></td>
          <td><?= e(number_format((float)$upgradeState['withdrawal_limit'])) ?> تومان</td>
          <td><a class="btn btn-sm" href="verifications.php?status=pending">بررسی در صف احراز هویت</a></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php endif; ?>
<div class="card">
  <div class="actions" style="justify-content: space-between;">
    <h3 style="margin:0;">لیست کاربران</h3>
    <?php if (can('create')): ?><button class="btn btn-primary" data-modal-open="createUserModal">افزودن کاربر</button><?php endif; ?>
  </div>
</div>

<div class="card">
  <div class="actions users-filter-shell" style="display:flex; align-items:center; gap:15px; flex-wrap:wrap; margin-bottom:1.5rem; overflow:visible !important;">
    <form method="get" class="actions" style="display:flex; align-items:center; gap:15px; flex-wrap:wrap; margin:0; overflow:visible !important;">
      <input type="hidden" name="page" value="1">
      <input type="text" class="filter-input js-persian-date" name="start_date" value="<?= e($startDate) ?>" placeholder="از تاریخ..." aria-label="از تاریخ" style="width:200px; max-width:200px;">
      <input type="text" class="filter-input js-persian-date" name="end_date" value="<?= e($endDate) ?>" placeholder="تا تاریخ..." aria-label="تا تاریخ" style="width:200px; max-width:200px;">
      <button type="submit" class="btn btn-primary" style="height:36px;">فیلتر</button>
    </form>
    <a class="btn btn-light" style="color:#2563eb;border-color:#bfdbfe; text-decoration:none; display:inline-flex; align-items:center; height:36px;" href="users.php?<?= e(http_build_query(array_merge($_GET, ['export' => 'excel']))) ?>">خروجی Excel</a>
    <a class="btn btn-light" style="color:#7c3aed;border-color:#ddd6fe; text-decoration:none; display:inline-flex; align-items:center; height:36px;" href="users.php?<?= e(http_build_query(array_merge($_GET, ['export' => 'print']))) ?>">خروجی PDF</a>
  </div>
  <div class="table-wrap">
    <table id="usersTable">
      <thead>
        <tr>
          <th>#</th><th>شماره موبایل</th><th>نام کامل</th><th>موجودی</th><th>پین کد</th><th>نقش</th><th>تاریخ ایجاد</th><th>عملیات</th>
        </tr>
        <tr class="filter-row">
          <th><input class="users-table-filter" data-col="0" placeholder="جستجو"></th>
          <th><input class="users-table-filter" data-col="1" placeholder="جستجو"></th>
          <th><input class="users-table-filter" data-col="2" placeholder="جستجو"></th>
          <th><input class="users-table-filter" data-col="3" placeholder="جستجو"></th>
          <th><input class="users-table-filter" data-col="4" placeholder="جستجو"></th>
          <th><input class="users-table-filter" data-col="5" placeholder="جستجو"></th>
          <th><input class="users-table-filter" data-col="6" placeholder="جستجو"></th>
          <th style="text-align:center;">
            <button type="button" class="btn btn-primary btn-sm" onclick="(function(){const evt=new Event('input',{bubbles:true});document.querySelectorAll('#usersTable .filter-row input[data-col]').forEach(i=>i.dispatchEvent(evt));})();">فیلتر</button>
          </th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($rows as $row): ?>
        <tr>
          <td><?= e((string)$row['id']) ?></td>
          <?php $rowVerification = verification_state((int)$row['id']); ?>
          <td><?= e($row['mobile']) ?><br><small>تأیید تلفن: <?= $rowVerification['phone_verified'] ? 'بله' : 'خیر' ?><?= $rowVerification['phone_verified_at'] ? ' / ' . e((string)$rowVerification['phone_verified_at']) : '' ?></small></td>
          <td><?= e(trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''))) ?></td>
          <td><span class="admin-balance-badge"><?= e(admin_balance_with_unit($row['balance'] ?? null)) ?></span></td>
          <td><?= e($row['pin_code'] ?? '-') ?></td>
          <td>
            <?= e($row['role']) ?><br>
            <small><?= e((string)$rowVerification['level']) ?> · <?= $rowVerification['withdrawal_limit'] === null ? 'بدون سقف اولیه' : e(number_format((float)$rowVerification['withdrawal_limit'])) . ' تومان' ?></small>
          </td>
          <td><?= e(to_jalali_datetime((string)$row['created_at'])) ?></td>
          <td class="text-nowrap">
            <div class="d-flex flex-row align-items-center users-row-actions" style="gap: 8px; flex-wrap: nowrap;">
              <?php if (can('edit')): ?>
                <button class="btn btn-light btn-sm" data-id="<?= e((string)$row['id']) ?>"
                        data-mobile="<?= e($row['mobile']) ?>"
                        data-balance="<?= e(admin_balance_with_unit($row['balance'] ?? null)) ?>"
                        onclick="openManualOperations(this)">عملیات دستی</button>
              <?php endif; ?>
              <?php if (can('edit')): ?>
                <button class="btn btn-light btn-sm" data-modal-open="editUserModal"
                        data-id="<?= e((string)$row['id']) ?>"
                        data-mobile="<?= e($row['mobile']) ?>"
                        data-first_name="<?= e($row['first_name'] ?? '') ?>"
                        data-last_name="<?= e($row['last_name'] ?? '') ?>"
                        data-balance="<?= e(admin_balance_with_unit($row['balance'] ?? null)) ?>"
                        data-pin_code="<?= e($row['pin_code'] ?? '') ?>"
                        data-role="<?= e($row['role']) ?>"
                        onclick="openEditUser(this)">ویرایش</button>
              <?php endif; ?>
              <?php if (can('delete')): ?>
                <form method="post" class="inline-form m-0 p-0" style="display:inline-block;" onsubmit="return confirm('کاربر حذف شود؟');">
                  <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= e((string)$row['id']) ?>">
                  <button class="btn btn-danger btn-sm">حذف</button>
                </form>
              <?php endif; ?>
            </div>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <div class="pagination">
    <?php for ($i = 1; $i <= $totalPages; $i++): ?>
      <a class="page-link <?= $i === $page ? 'active' : '' ?>" href="users.php?<?= e(http_build_query(array_merge($_GET, ['page' => $i]))) ?>"><?= $i ?></a>
    <?php endfor; ?>
  </div>
</div>

<?php if (can('create')): ?>
<div class="modal-backdrop" id="createUserModal">
  <div class="modal">
    <div class="modal-head"><h4 class="modal-title">افزودن کاربر</h4><button class="icon-btn" data-modal-close="createUserModal">×</button></div>
    <div class="modal-body">
      <form method="post" class="form-grid">
        <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
        <input type="hidden" name="action" value="create">
        <div class="col-3"><label class="field-label">شماره موبایل</label><input class="input" name="mobile"></div>
        <div class="col-3"><label class="field-label">نام</label><input class="input" name="first_name"></div>
        <div class="col-3"><label class="field-label">نام خانوادگی</label><input class="input" name="last_name"></div>
        <div class="col-3"><label class="field-label">پین کد</label><input class="input" name="pin_code"></div>
        <div class="col-4"><label class="field-label">رمز عبور</label><input class="input" type="password" name="password"></div>
        <div class="col-4"><label class="field-label">نقش</label>
          <select class="select" name="role"><option>viewer</option><option>editor</option><option>admin</option></select>
        </div>
        <div class="col-4"></div>
        <div class="col-12 actions"><button class="btn btn-primary">ثبت</button></div>
      </form>
    </div>
  </div>
</div>
<?php endif; ?>

<?php if (can('edit')): ?>
<div class="modal-backdrop" id="manualOperationsModal">
  <div class="modal">
    <div class="modal-head"><h4 class="modal-title">عملیات دستی</h4><button class="icon-btn" data-modal-close="manualOperationsModal">×</button></div>
    <div class="modal-body">
      <form method="post" class="form-grid">
        <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
        <input type="hidden" name="action" value="manual_operation">
        <input type="hidden" name="operation_nonce" value="<?= e($manualOperationNonce) ?>">
        <input type="hidden" name="user_id" id="manualOperationUserId">
        <div class="col-12">
          <p id="manualOperationUserHint" class="field-label">کاربر: -</p>
        </div>
        <div class="col-12"><div id="manualOperationBalance" class="admin-balance-panel">موجودی فعلی حساب: —</div></div>
        <div class="col-6">
          <label class="field-label">نوع عملیات</label>
          <select class="select" id="manualOperationType" name="manual_action" onchange="toggleRemittanceFields(this.value)">
            <option value="increase">افزایش موجودی</option>
            <option value="decrease">کاهش موجودی</option>
            <option value="remittance">ثبت حواله</option>
          </select>
        </div>
        <div class="col-6">
          <label class="field-label">مبلغ (تومان)</label>
          <input class="input" name="amount" type="number" step="0.01" min="0.01" dir="ltr" required>
        </div>
        <div class="col-4 manual-remittance-field">
          <label class="field-label">نمایندگی</label>
          <input class="input" name="agency" id="manualOperationAgency">
        </div>
        <div class="col-4 manual-remittance-field">
          <label class="field-label">فرستنده</label>
          <input class="input" name="sender" id="manualOperationSender">
        </div>
        <div class="col-4 manual-remittance-field">
          <label class="field-label">گیرنده</label>
          <input class="input" name="receiver" id="manualOperationReceiver">
        </div>
        <div class="col-6 manual-remittance-field">
          <label class="field-label">مبلغ افغانی</label>
          <input class="input" name="amount_afghani" id="manualOperationAmountAfghani" step="0.01" type="number" min="0">
        </div>
        <div class="col-12 actions">
          <button class="btn btn-primary" id="manualOperationSubmitButton">ثبت</button>
        </div>
      </form>
    </div>
  </div>
</div>
<?php endif; ?>

<?php if (can('edit')): ?>
<div class="modal-backdrop" id="editUserModal">
  <div class="modal">
    <div class="modal-head"><h4 class="modal-title">ویرایش کاربر</h4><button class="icon-btn" data-modal-close="editUserModal">×</button></div>
    <div class="modal-body">
      <form method="post" class="form-grid">
        <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
        <input type="hidden" name="action" value="update">
        <input type="hidden" name="id" id="editUserId">
        <div class="col-12"><div id="editUserBalance" class="admin-balance-panel">موجودی فعلی حساب: —</div></div>
        <div class="col-3"><label class="field-label">شماره موبایل</label><input class="input" id="editUserMobile" name="mobile"></div>
        <div class="col-3"><label class="field-label">نام</label><input class="input" id="editUserFirstName" name="first_name"></div>
        <div class="col-3"><label class="field-label">نام خانوادگی</label><input class="input" id="editUserLastName" name="last_name"></div>
        <div class="col-3"><label class="field-label">پین کد</label><input class="input" id="editUserPinCode" name="pin_code"></div>
        <div class="col-4"><label class="field-label">رمز عبور جدید (اختیاری)</label><input class="input" type="password" name="new_password"></div>
        <div class="col-4"><label class="field-label">نقش</label>
          <select class="select" id="editUserRole" name="role"><option>viewer</option><option>editor</option><option>admin</option></select>
        </div>
        <div class="col-4"></div>
        <div class="col-12 actions"><button class="btn btn-primary">ذخیره</button></div>
      </form>
    </div>
  </div>
</div>
<?php endif; ?>

<script>
  function openEditUser(btn) {
    document.getElementById('editUserId').value = btn.dataset.id || '';
    document.getElementById('editUserMobile').value = btn.dataset.mobile || '';
    document.getElementById('editUserFirstName').value = btn.dataset.first_name || '';
    document.getElementById('editUserLastName').value = btn.dataset.last_name || '';
    document.getElementById('editUserBalance').textContent = 'موجودی فعلی حساب: ' + (btn.dataset.balance || '—');
    document.getElementById('editUserPinCode').value = btn.dataset.pin_code || '';
    document.getElementById('editUserRole').value = btn.dataset.role || 'viewer';
  }

  function openManualOperations(btn) {
    const modal = document.getElementById('manualOperationsModal');
    if (!modal) return;

    document.querySelector('#manualOperationsModal form').reset();
    document.getElementById('manualOperationUserId').value = btn.dataset.id || '';
    document.getElementById('manualOperationUserHint').textContent = 'کاربر: ' + (btn.dataset.mobile || '-');
    document.getElementById('manualOperationBalance').textContent = 'موجودی فعلی حساب: ' + (btn.dataset.balance || '—');
    document.getElementById('manualOperationAgency').value = '';
    document.getElementById('manualOperationSender').value = '';
    document.getElementById('manualOperationReceiver').value = '';
    document.getElementById('manualOperationAmountAfghani').value = '';
    const typeSelect = document.getElementById('manualOperationType');
    typeSelect.value = 'increase';
    toggleRemittanceFields(typeSelect.value);
    modal.classList.add('open');
  }

  function toggleRemittanceFields(type) {
    const isRemittance = type === 'remittance';
    const submitButton = document.getElementById('manualOperationSubmitButton');
    const fields = document.querySelectorAll('.manual-remittance-field');
    const agency = document.getElementById('manualOperationAgency');
    const sender = document.getElementById('manualOperationSender');
    const receiver = document.getElementById('manualOperationReceiver');
    const amountAfghani = document.getElementById('manualOperationAmountAfghani');

    fields.forEach((field) => {
      field.style.display = isRemittance ? '' : 'none';
    });

    if (agency) agency.required = isRemittance;
    if (sender) sender.required = isRemittance;
    if (receiver) receiver.required = isRemittance;

    if (amountAfghani) {
      amountAfghani.required = isRemittance;
      if (!isRemittance) {
        amountAfghani.value = '';
      }
    }

    if (submitButton) {
      submitButton.textContent = isRemittance ? 'ثبت حواله' : 'ثبت عملیات';
    }
  }

  (function () {
    const table = document.getElementById('usersTable');
    if (!table) return;
    const filters = table.querySelectorAll('.filter-row input[data-col]');
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    function applyFilters() {
      rows.forEach((row) => {
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
