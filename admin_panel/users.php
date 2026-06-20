<?php
declare(strict_types=1);
require_once __DIR__ . '/layout.php';
require_login();
require_permission('view');

$perPage = 10;
$page = max(1, (int)($_GET['page'] ?? 1));
$offset = ($page - 1) * $perPage;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf_or_fail($_POST['csrf_token'] ?? null);
    $action = $_POST['action'] ?? '';

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

$totalRows = (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
$totalPages = max(1, (int)ceil($totalRows / $perPage));

$stmt = db()->prepare('SELECT id, mobile, first_name, last_name, pin_code, role, created_at FROM users ORDER BY id DESC LIMIT :limit OFFSET :offset');
$stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll();

$csrf = csrf_token();

render_page_start('مدیریت کاربران', 'users');
?>
<div class="card">
  <div class="actions" style="justify-content: space-between;">
    <h3 style="margin:0;">لیست کاربران</h3>
    <?php if (can('create')): ?><button class="btn btn-primary" data-modal-open="createUserModal">افزودن کاربر</button><?php endif; ?>
  </div>
</div>

<div class="card">
  <div class="table-wrap">
    <table id="usersTable">
      <thead>
        <tr>
          <th>#</th><th>شماره موبایل</th><th>نام کامل</th><th>پین کد</th><th>نقش</th><th>تاریخ ایجاد</th><th>عملیات</th>
        </tr>
        <tr class="filter-row">
          <th><input data-col="0" placeholder="جستجو"></th>
          <th><input data-col="1" placeholder="جستجو"></th>
          <th><input data-col="2" placeholder="جستجو"></th>
          <th><input data-col="3" placeholder="جستجو"></th>
          <th><input data-col="4" placeholder="جستجو"></th>
          <th><input data-col="5" placeholder="جستجو"></th>
          <th></th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($rows as $row): ?>
        <tr>
          <td><?= e((string)$row['id']) ?></td>
          <td><?= e($row['mobile']) ?></td>
          <td><?= e(trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''))) ?></td>
          <td><?= e($row['pin_code'] ?? '-') ?></td>
          <td><?= e($row['role']) ?></td>
          <td><?= e(to_jalali_datetime((string)$row['created_at'])) ?></td>
          <td>
            <div class="actions">
              <?php if (can('edit')): ?>
                <button class="btn btn-light" data-modal-open="editUserModal"
                        data-id="<?= e((string)$row['id']) ?>"
                        data-mobile="<?= e($row['mobile']) ?>"
                        data-first_name="<?= e($row['first_name'] ?? '') ?>"
                        data-last_name="<?= e($row['last_name'] ?? '') ?>"
                        data-pin_code="<?= e($row['pin_code'] ?? '') ?>"
                        data-role="<?= e($row['role']) ?>"
                        onclick="openEditUser(this)">ویرایش</button>
              <?php endif; ?>
              <?php if (can('delete')): ?>
                <form method="post" class="inline-form" onsubmit="return confirm('کاربر حذف شود؟');">
                  <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= e((string)$row['id']) ?>">
                  <button class="btn btn-danger">حذف</button>
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
      <a class="page-link <?= $i === $page ? 'active' : '' ?>" href="users.php?page=<?= $i ?>"><?= $i ?></a>
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
<div class="modal-backdrop" id="editUserModal">
  <div class="modal">
    <div class="modal-head"><h4 class="modal-title">ویرایش کاربر</h4><button class="icon-btn" data-modal-close="editUserModal">×</button></div>
    <div class="modal-body">
      <form method="post" class="form-grid">
        <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
        <input type="hidden" name="action" value="update">
        <input type="hidden" name="id" id="editUserId">
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
    document.getElementById('editUserPinCode').value = btn.dataset.pin_code || '';
    document.getElementById('editUserRole').value = btn.dataset.role || 'viewer';
  }
  (function () {
    const table = document.getElementById('usersTable');
    if (!table) return;
    const filters = table.querySelectorAll('.filter-row input');
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
