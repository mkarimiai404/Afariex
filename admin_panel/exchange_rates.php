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
    
    // پردازش درخواست غیرفعال‌سازی نرخ فعلی
    if (isset($_POST['deactivate_rate'])) {
        require_permission('create'); // فرض بر این است که مجوز ایجاد برای ویرایش نیز معتبر است
        db()->exec('UPDATE exchange_rates SET is_active = 0 WHERE is_active = 1');
        log_activity('update', 'exchange_rates', 0, "غیرفعال‌سازی دستی نرخ فعال سیستم");
        flash('success', 'نرخ فعال سیستم با موفقیت غیرفعال شد.');
        header('Location: exchange_rates.php?page=' . $page);
        exit;
    }

    // پردازش فرم ثبت نرخ جدید
    require_permission('create');
    $rate = (float)($_POST['rate'] ?? 0);
    $afnToToman = (float)($_POST['afn_to_toman'] ?? 0);
    $tomanToAfn = (float)($_POST['toman_to_afn'] ?? 0);
    $effectiveDate = trim($_POST['effective_date'] ?? '');
    $isActive = isset($_POST['is_active']) ? 1 : 0;

    if ($rate <= 0 || $afnToToman <= 0 || $tomanToAfn <= 0 || $effectiveDate === '') {
        flash('error', 'لطفا تمام فیلدها را کامل وارد کنید.');
    } else {
        if ($isActive === 1) {
            db()->exec('UPDATE exchange_rates SET is_active = 0 WHERE is_active = 1');
        }
        $stmt = db()->prepare('
            INSERT INTO exchange_rates (rate, afn_to_toman, toman_to_afn, effective_date, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        ');
        $stmt->execute([$rate, $afnToToman, $tomanToAfn, $effectiveDate, $isActive]);
        log_activity('create', 'exchange_rates', (int)db()->lastInsertId(), "ثبت نرخ جدید: {$rate}");
        flash('success', 'نرخ ارز با موفقیت ثبت شد.');
    }
    header('Location: exchange_rates.php?page=' . $page);
    exit;
}

$current = db()->query('
    SELECT id, rate, afn_to_toman, toman_to_afn, effective_date, is_active, created_at
    FROM exchange_rates WHERE is_active = 1 ORDER BY id DESC LIMIT 1
')->fetch();

$totalRows = (int)db()->query('SELECT COUNT(*) FROM exchange_rates')->fetchColumn();
$totalPages = max(1, (int)ceil($totalRows / $perPage));

$stmt = db()->prepare('
    SELECT id, rate, afn_to_toman, toman_to_afn, effective_date, is_active, created_at
    FROM exchange_rates ORDER BY id DESC LIMIT :limit OFFSET :offset
');
$stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll();

$csrf = csrf_token();

render_page_start('مدیریت نرخ ارز', 'rates');
?>

<style>
  /* استایل‌های مدرن‌سازی بدون تداخل با layout اصلی */
  .modern-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
  .modern-header h3 {
    margin: 0;
    font-weight: 800;
    color: var(--heading, #1e293b);
  }
  
  /* استایل کارت نرخ فعلی */
  .current-rate-box {
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border: 1px solid #bfdbfe;
    border-radius: 12px;
    padding: 16px 20px;
    margin-top: 20px;
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    align-items: center;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.05);
  }
  .rate-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rate-label {
    font-size: 13px;
    color: #3b82f6;
    font-weight: 700;
  }
  .rate-value {
    font-size: 18px;
    color: #1e3a8a;
    font-weight: 800;
    direction: ltr;
    text-align: right;
  }

  /* دکمه غیرفعال سازی نرخ */
  .btn-deactivate {
    background-color: #fef2f2;
    color: #ef4444;
    border: 1px solid #fecaca;
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .btn-deactivate:hover {
    background-color: #fee2e2;
    border-color: #f87171;
  }

  /* استایل جدول و فیلترها */
  .filter-row th {
    padding: 8px !important;
    background: #f8fafc;
    border-bottom: 2px solid #e2e8f0;
  }
  .filter-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 13px;
    outline: none;
    transition: all 0.2s;
    background: #fff;
  }
  .filter-input:focus {
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }
  .badge-id {
    background: #f1f5f9;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #475569;
    display: inline-block;
  }
  .badge-status {
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    display: inline-block;
  }
  .badge-active { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
  .badge-inactive { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
  
  #ratesTable th {
    background: #f1f5f9;
    color: #475569;
    font-weight: 700;
    padding: 14px 12px;
    text-align: right;
  }
  #ratesTable td {
    padding: 14px 12px;
    vertical-align: middle;
    border-bottom: 1px solid #f1f5f9;
  }
  #ratesTable tbody tr:hover {
    background-color: #f8fafc;
  }

  /* صفحه‌بندی */
  .pagination {
    display: flex;
    gap: 8px;
    margin-top: 20px;
    justify-content: center;
  }
  .page-link {
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #fff;
    color: var(--text, #334155);
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s;
  }
  .page-link:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }
  .page-link.active {
    background: var(--primary, #3b82f6);
    color: #fff;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);
  }
</style>

<!-- کارت هدر و نرخ فعال -->
<div class="card">
  <div class="actions modern-header">
    <h3>تاریخچه نرخ ارز</h3>
    <?php if (can('create')): ?>
      <button class="btn btn-primary" data-modal-open="createRateModal">
        <span style="margin-left: 4px; font-weight: bold;">+</span> ثبت نرخ جدید
      </button>
    <?php endif; ?>
  </div>
  
  <?php if ($current): ?>
    <div class="current-rate-box">
      <div class="rate-item">
        <span class="rate-label">وضعیت</span>
        <span class="badge-status badge-active" style="width: max-content;">نرخ فعال سیستم</span>
      </div>
      <div class="rate-item">
        <span class="rate-label">نرخ پایه (Rate)</span>
        <span class="rate-value"><?= e((string)$current['rate']) ?></span>
      </div>
      <div class="rate-item">
        <span class="rate-label">۱ افغانی به تومان</span>
        <span class="rate-value"><?= e((string)$current['afn_to_toman']) ?></span>
      </div>
      <div class="rate-item">
        <span class="rate-label">۱ تومان به افغانی</span>
        <span class="rate-value"><?= e((string)$current['toman_to_afn']) ?></span>
      </div>
      <div class="rate-item">
        <span class="rate-label">تاریخ موثر</span>
        <span class="rate-value" style="direction: rtl; color: #475569; font-weight: 600; font-size: 15px;">
          <?= e((string)$current['effective_date']) ?>
        </span>
      </div>
      
      <!-- بخش دکمه غیرفعال سازی با حاشیه سمت راست اتوماتیک برای هل دادن به سمت چپ -->
      <div class="rate-item" style="margin-right: auto; justify-content: center;">
        <?php if (can('create')): ?>
        <form method="post" onsubmit="return confirm('آیا مطمئن هستید که می‌خواهید نرخ فعلی را غیرفعال کنید؟ سیستم بدون نرخ فعال خواهد ماند.');">
            <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
            <input type="hidden" name="deactivate_rate" value="1">
            <button type="submit" class="btn-deactivate" title="غیرفعال کردن نرخ فعلی">
                <span style="font-size: 16px;">×</span> غیرفعال‌سازی
            </button>
        </form>
        <?php endif; ?>
      </div>
    </div>
  <?php endif; ?>
</div>

<!-- کارت جدول -->
<div class="card">
  <div class="table-wrap" style="border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <table id="ratesTable" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th width="5%">#</th>
          <th width="15%">Rate</th>
          <th width="15%">۱ افغانی به تومان</th>
          <th width="15%">۱ تومان به افغانی</th>
          <th width="15%">تاریخ موثر</th>
          <th width="10%">وضعیت</th>
          <th width="15%">تاریخ ثبت</th>
        </tr>
        <tr class="filter-row">
          <th><input type="text" class="filter-input" data-col="0" placeholder="شناسه"></th>
          <th><input type="text" class="filter-input" data-col="1" placeholder="جستجو Rate"></th>
          <th><input type="text" class="filter-input" data-col="2" placeholder="جستجو"></th>
          <th><input type="text" class="filter-input" data-col="3" placeholder="جستجو"></th>
          <th><input type="text" class="filter-input" data-col="4" placeholder="جستجو تاریخ"></th>
          <th><input type="text" class="filter-input" data-col="5" placeholder="وضعیت"></th>
          <th><input type="text" class="filter-input" data-col="6" placeholder="تاریخ ثبت"></th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($rows as $row): ?>
        <tr>
          <td><span class="badge-id"><?= e((string)$row['id']) ?></span></td>
          <td dir="ltr" style="font-weight: 700; color: #1e293b; text-align: right;"><?= e((string)$row['rate']) ?></td>
          <td dir="ltr" style="color: #475569; text-align: right;"><?= e((string)$row['afn_to_toman']) ?></td>
          <td dir="ltr" style="color: #475569; text-align: right;"><?= e((string)$row['toman_to_afn']) ?></td>
          <td dir="ltr" style="color: #64748b; text-align: right; font-size: 14px;"><?= e((string)$row['effective_date']) ?></td>
          <td>
            <?php if ((int)$row['is_active'] === 1): ?>
              <span class="badge-status badge-active">فعال</span>
            <?php else: ?>
              <span class="badge-status badge-inactive">غیرفعال</span>
            <?php endif; ?>
          </td>
          <td dir="ltr" style="color: #64748b; text-align: right; font-size: 13px;"><?= e(to_jalali_datetime((string)$row['created_at'])) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  
  <?php if ($totalPages > 1): ?>
  <div class="pagination">
    <?php for ($i = 1; $i <= $totalPages; $i++): ?>
      <a class="page-link <?= $i === $page ? 'active' : '' ?>" href="exchange_rates.php?page=<?= $i ?>"><?= $i ?></a>
    <?php endfor; ?>
  </div>
  <?php endif; ?>
</div>

<!-- مودال ثبت نرخ جدید -->
<?php if (can('create')): ?>
<div class="modal-backdrop" id="createRateModal">
  <div class="modal">
    <div class="modal-head">
      <h4 class="modal-title">ثبت نرخ جدید</h4>
      <button class="icon-btn" data-modal-close="createRateModal">×</button>
    </div>
    <div class="modal-body">
      <form method="post" class="form-grid">
        <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
        <div class="col-3">
          <label class="field-label">Rate</label>
          <input class="input" type="number" step="any" name="rate" dir="ltr" placeholder="0.0000">
        </div>
        <div class="col-3">
          <label class="field-label">۱ افغانی = تومان</label>
          <input class="input" type="number" step="any" name="afn_to_toman" dir="ltr" placeholder="0.0000">
        </div>
        <div class="col-3">
          <label class="field-label">۱ تومان = افغانی</label>
          <input class="input" type="number" step="any" name="toman_to_afn" dir="ltr" placeholder="0.0000">
        </div>
        <div class="col-3">
          <label class="field-label">تاریخ موثر</label>
          <input class="input" type="date" name="effective_date" dir="ltr">
        </div>
        <div class="col-12" style="margin-top: 10px;">
          <label class="checkbox-wrap" style="display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer;">
            <input type="checkbox" name="is_active" checked style="width: 18px; height: 18px; accent-color: var(--primary, #3b82f6);"> 
            به عنوان نرخ فعال سیستم ثبت شود
          </label>
        </div>
        <div class="col-12 actions" style="margin-top: 15px;">
          <button class="btn btn-primary" style="width: 100%;">ثبت اطلاعات</button>
        </div>
      </form>
    </div>
  </div>
</div>
<?php endif; ?>

<script>
  (function () {
    const table = document.getElementById('ratesTable');
    if (!table) return;
    const filters = table.querySelectorAll('.filter-row input');
    // با انتخاب دقیق tbody tr، ردیف فیلتر که در thead است تداخل ایجاد نمی‌کند
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
