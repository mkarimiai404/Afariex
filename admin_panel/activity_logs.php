<?php
declare(strict_types=1);
require_once __DIR__ . '/layout.php';
require_login();
require_permission('view');

if (!table_exists('activity_logs')) {
    render_page_start('گزارش فعالیت', 'logs');
    ?>
    <div class="card">
      <p style="color: var(--danger); font-weight: 600;">جدول `activity_logs` در پایگاه‌داده موجود نیست. برای فعال‌سازی گزارش‌ها، این جدول را ایجاد کنید.</p>
      <pre style="white-space:pre-wrap; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; color: var(--text); direction: ltr; text-align: left;">
CREATE TABLE activity_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL
);
      </pre>
    </div>
    <?php
    render_page_end();
    exit;
}

$perPage = 15;
$page = max(1, (int)($_GET['page'] ?? 1));
$offset = ($page - 1) * $perPage;

$totalRows = (int)db()->query('SELECT COUNT(*) FROM activity_logs')->fetchColumn();
$totalPages = max(1, (int)ceil($totalRows / $perPage));

$stmt = db()->prepare('
    SELECT l.id, l.user_id, l.action, l.entity, l.entity_id, l.description, l.created_at, u.mobile
    FROM activity_logs l
    LEFT JOIN users u ON u.id = l.user_id
    ORDER BY l.id DESC
    LIMIT :limit OFFSET :offset
');
$stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll();

render_page_start('گزارش فعالیت', 'logs');
?>

<style>
  /* استایل‌های اختصاصی برای زیباتر شدن این صفحه */
  .filter-row th {
    padding: 8px;
    background: #f1f5f9;
  }
  .filter-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
  }
  .filter-input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  .pagination {
    display: flex;
    gap: 8px;
    margin-top: 24px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .page-link {
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: #fff;
    color: var(--text);
    font-weight: 700;
    font-size: 14px;
    transition: all 0.2s;
  }
  .page-link:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }
  .page-link.active {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
    box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);
  }
</style>

<div class="card">
  <h3 style="margin-top:0; margin-bottom:20px; font-weight:800; color:var(--heading);">گزارش عملیات کاربران</h3>
  <div class="table-wrap">
    <table id="logsTable">
      <thead>
        <tr>
          <th>#</th>
          <th>کاربر (شماره موبایل)</th>
          <th>Action</th>
          <th>Entity</th>
          <th>Entity ID</th>
          <th>توضیحات</th>
          <th>تاریخ</th>
        </tr>
        <tr class="filter-row">
          <th><input type="text" class="filter-input" data-col="0" placeholder="جستجو..."></th>
          <th><input type="text" class="filter-input" data-col="1" placeholder="جستجو..."></th>
          <th><input type="text" class="filter-input" data-col="2" placeholder="جستجو..."></th>
          <th><input type="text" class="filter-input" data-col="3" placeholder="جستجو..."></th>
          <th><input type="text" class="filter-input" data-col="4" placeholder="جستجو..."></th>
          <th><input type="text" class="filter-input" data-col="5" placeholder="جستجو..."></th>
          <th><input type="text" class="filter-input" data-col="6" placeholder="جستجو..."></th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($rows as $row): ?>
        <tr>
          <td><?= e((string)$row['id']) ?></td>
          <td><?= e($row['mobile'] ?? ('user#' . $row['user_id'])) ?></td>
          <td><span style="background:#f1f5f9; padding:4px 8px; border-radius:6px; font-size:12px;"><?= e($row['action']) ?></span></td>
          <td><span style="background:#f1f5f9; padding:4px 8px; border-radius:6px; font-size:12px;"><?= e($row['entity']) ?></span></td>
          <td><?= e((string)($row['entity_id'] ?? '-')) ?></td>
          <td><?= e($row['description'] ?? '-') ?></td>
          <td dir="ltr" style="text-align: right;"><?= e(to_jalali_datetime((string)$row['created_at'])) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  
  <?php if ($totalPages > 1): ?>
  <div class="pagination">
    <?php for ($i = 1; $i <= $totalPages; $i++): ?>
      <a class="page-link <?= $i === $page ? 'active' : '' ?>" href="activity_logs.php?page=<?= $i ?>"><?= $i ?></a>
    <?php endfor; ?>
  </div>
  <?php endif; ?>
</div>

<script>
  (function () {
    const table = document.getElementById('logsTable');
    if (!table) return;
    
    const filters = table.querySelectorAll('.filter-row input');
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    
    // تکمیل کد جاوااسکریپت ناقص شما برای فیلتر کردن ردیف‌ها
    function applyFilters() {
      rows.forEach((row) => {
        let showRow = true;
        
        filters.forEach((input) => {
          const colIndex = input.getAttribute('data-col');
          const filterValue = input.value.toLowerCase().trim();
          
          if (filterValue !== '') {
            const cellText = row.children[colIndex].textContent.toLowerCase();
            if (!cellText.includes(filterValue)) {
              showRow = false;
            }
          }
        });
        
        row.style.display = showRow ? '' : 'none';
      });
    }

    filters.forEach((input) => {
      input.addEventListener('input', applyFilters);
    });
  })();
</script>

<?php render_page_end(); ?>
