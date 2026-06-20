<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

function render_page_start(string $title, string $activePage, bool $showSidebar = true): void
{
    $flash = get_flash();
    $menu = [
        'index' => ['label' => 'داشبورد', 'href' => 'index.php'],
        'agencies' => ['label' => 'نمایندگی‌ها', 'href' => 'agencies.php'],
        'rates' => ['label' => 'نرخ ارز', 'href' => 'exchange_rates.php'],
        'remittances' => ['label' => 'حواله‌ها', 'href' => 'remittances.php'],
        'receipts' => ['label' => 'فیش‌های واریزی', 'href' => 'receipts.php'],
        'users' => ['label' => 'کاربران', 'href' => 'users.php'],
        'logs' => ['label' => 'گزارش فعالیت', 'href' => 'activity_logs.php'],
    ];
    ?>
<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= e($title) ?> | پنل مدیریت</title>
  <style>
    @font-face {
      font-family: 'Vazirmatn';
      src: url('fonts/Vazirmatn-Regular.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Vazirmatn';
      src: url('fonts/Vazirmatn-Bold.woff2') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    
    /* پالت رنگی حرفه‌ای و مدرن */
    :root {
      --bg: #f8fafc; 
      --card: #ffffff; 
      --text: #334155; 
      --heading: #0f172a;
      --muted: #64748b; 
      --line: #e2e8f0;
      --primary: #3b82f6; 
      --primary-dark: #2563eb; 
      --danger: #ef4444; 
      --danger-dark: #dc2626;
      --success-bg: #ecfdf5; 
      --success-text: #059669; 
      --error-bg: #fef2f2; 
      --error-text: #dc2626;
      --sidebar-bg: #0f172a; 
      --sidebar-item: #1e293b;
      --sidebar-text: #94a3b8;
      --sidebar-active: #3b82f6;
    }
    
    * { box-sizing: border-box; }
    html, body, h1, h2, h3, h4, h5, h6, p, span, a, li, label, div, table, th, td, input, textarea, select, button {
      font-family: 'Vazirmatn', Tahoma, sans-serif !important;
    }
    
    body { 
      margin: 0; 
      direction: rtl; 
      background: var(--bg); 
      color: var(--text); 
      -webkit-font-smoothing: antialiased;
    }
    
    a { text-decoration: none; color: inherit; }
    
    /* ساختار اصلی */
    .app-shell { 
      height: 100vh; 
      display: flex; 
      overflow: hidden;
    }
    
    /* سایدبار سمت راست */
    .sidebar { 
      width: 280px; 
      background: var(--sidebar-bg); 
      color: #fff; 
      padding: 24px 16px; 
      display: flex;
      flex-direction: column;
      box-shadow: -4px 0 24px rgba(0,0,0,0.08); 
      z-index: 100;
      overflow-y: auto;
    }
    
    /* محتوای سمت چپ */
    .content { 
      flex: 1; 
      padding: 24px 32px; 
      overflow-y: auto;
      height: 100vh;
    }
    
    .brand { 
      font-size: 24px; 
      font-weight: 800; 
      margin: 10px 8px 36px; 
      text-align: center;
      letter-spacing: -0.5px;
      color: #ffffff;
    }
    .brand span { color: var(--primary); }
    
    /* طراحی مدرن منوها */
    .nav-list { display: grid; gap: 8px; }
    .nav-link { 
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px; 
      border-radius: 12px; 
      color: var(--sidebar-text); 
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
      position: relative;
    }
    
    .nav-link::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: transparent;
      transition: all 0.3s ease;
    }

    .nav-link:hover { 
      background: var(--sidebar-item); 
      color: #ffffff; 
      transform: translateX(-4px);
    }
    
    .nav-link.active { 
      background: rgba(59, 130, 246, 0.1); 
      color: #ffffff; 
      border: 1px solid rgba(59, 130, 246, 0.2);
    }
    
    .nav-link.active::before {
      background: var(--sidebar-active);
      box-shadow: 0 0 10px var(--sidebar-active);
    }

    .nav-link.logout { 
      background: rgba(239, 68, 68, 0.1); 
      color: #ef4444; 
      margin-top: 24px; 
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .nav-link.logout::before { display: none; }
    .nav-link.logout:hover { 
      background: var(--danger); 
      color: #fff; 
      transform: translateY(-2px);
    }

    /* نوار بالایی مدرن (کارت شیشه‌ای) */
    .topbar { 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      margin-bottom: 24px; 
      background: #ffffff;
      padding: 16px 24px;
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.03);
      border: 1px solid var(--line);
    }
    
    .page-title { 
      margin: 0; 
      font-size: 22px; 
      font-weight: 800; 
      color: var(--heading);
    }
    
    .user-pill { 
      background: #f8fafc; 
      border: 1px solid #e2e8f0; 
      border-radius: 999px; 
      padding: 8px 16px; 
      font-size: 13px; 
      font-weight: 600;
      color: var(--text); 
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* هشدارها */
    .alert { 
      border-radius: 12px; 
      padding: 14px 16px; 
      margin-bottom: 20px; 
      font-size: 14px; 
      font-weight: 600;
      border: 1px solid transparent; 
      display: flex;
      align-items: center;
    }
    .alert.success { background: var(--success-bg); color: var(--success-text); border-color: #a7f3d0; }
    .alert.error { background: var(--error-bg); color: var(--error-text); border-color: #fecaca; }

    /* کارت‌های پایه برای صفحات مختلف */
    .card { 
      background: var(--card); 
      border-radius: 16px; 
      border: 1px solid var(--line); 
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02); 
      padding: 24px; 
      margin-bottom: 20px; 
    }

    .grid { display: grid; gap: 16px; }
    .grid.cols-3 { grid-template-columns: repeat(3, minmax(0,1fr)); }
    
    /* فرم‌ها */
    .form-grid { display: grid; gap: 16px; grid-template-columns: repeat(12, minmax(0,1fr)); }
    .col-2 { grid-column: span 2; } .col-3 { grid-column: span 3; } .col-4 { grid-column: span 4; } .col-5 { grid-column: span 5; } .col-6 { grid-column: span 6; } .col-8 { grid-column: span 8; } .col-12 { grid-column: span 12; }
    
    .field-label { display: block; font-size: 13px; color: var(--text); margin-bottom: 8px; font-weight: 700; }
    .input, .select {
      width: 100%; height: 44px; border: 1px solid var(--line); border-radius: 10px; padding: 0 14px; font-size: 14px; background: #f8fafc; outline: none; color: var(--heading);
      transition: all .2s ease;
    }
    .input:focus, .select:focus { 
      background: #ffffff;
      border-color: var(--primary); 
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); 
    }

    /* دکمه‌ها */
    .btn { 
      height: 44px; border: 0; border-radius: 10px; padding: 0 20px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all .2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn:active { transform: translateY(2px); }
    .btn-primary { background: var(--primary); color: #fff; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); } 
    .btn-primary:hover { background: var(--primary-dark); box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3); }
    .btn-danger { background: var(--danger); color: #fff; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); } 
    .btn-danger:hover { background: var(--danger-dark); }
    .btn-light { background: #f1f5f9; color: #334155; border: 1px solid var(--line); } 
    .btn-light:hover { background: #e2e8f0; }

    /* جداول دیفالت */
    .table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--line); box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
    table { width: 100%; border-collapse: collapse; min-width: 920px; background: #fff; }
    th, td { padding: 14px 16px; text-align: right; border-bottom: 1px solid #f1f5f9; font-size: 13px; white-space: nowrap; }
    th { background: #f8fafc; color: var(--muted); font-weight: 700; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
    tr:hover td { background: #fcfdff; }
    
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .inline-form { display: inline; }
    
    /* مودال */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.6); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
    .modal-backdrop.open { display: flex; }
    .modal { width: min(960px, 98%); max-height: 90vh; overflow: auto; background: #fff; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
    .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--line); background: #f8fafc; border-radius: 20px 20px 0 0; }
    .modal-title { font-size: 18px; font-weight: 800; margin: 0; color: var(--heading); }
    .modal-body { padding: 24px; }
    
    .icon-btn { border: 0; background: #f1f5f9; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; font-size: 18px; color: var(--text); display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .icon-btn:hover { background: #e2e8f0; color: var(--danger); transform: rotate(90deg); }

    /* ریسپانسیو */
    @media (max-width: 1024px) {
      .grid.cols-3 { grid-template-columns: 1fr; }
      .col-2,.col-3,.col-4,.col-5,.col-6,.col-8,.col-12 { grid-column: span 12; }
    }
    @media (max-width: 840px) {
      .app-shell { flex-direction: column; overflow: auto; }
      .sidebar { width: 100%; order: 1; border-radius: 0; padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); height: auto; }
      .content { order: 2; padding: 16px; height: auto; overflow: visible; }
      .topbar { flex-direction: column; gap: 12px; align-items: flex-start; }
    }
  </style>
</head>
<body>
<?php if ($showSidebar): ?>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">Afariex <span>Admin</span></div>
      <nav class="nav-list">
        <?php foreach ($menu as $key => $item): ?>
          <a class="nav-link <?= $activePage === $key ? 'active' : '' ?>" href="<?= e($item['href']) ?>"><?= e($item['label']) ?></a>
        <?php endforeach; ?>
        <a class="nav-link logout" href="logout.php">خروج از سیستم</a>
      </nav>
    </aside>
    <main class="content">
      <div class="topbar">
        <h1 class="page-title"><?= e($title) ?></h1>
        <div class="user-pill">👤 کاربر: <?= e($_SESSION['admin_username'] ?? 'admin') ?> &nbsp;|&nbsp; 🛡️ نقش: <?= e(current_role()) ?></div>
      </div>
      <?php if ($flash): ?>
        <div class="alert <?= $flash['type'] === 'success' ? 'success' : 'error' ?>"><?= e($flash['message']) ?></div>
      <?php endif; ?>
<?php endif; ?>
<?php
}

function render_page_end(bool $showSidebar = true): void
{
    if ($showSidebar) {
        echo '</main></div>';
    }
    ?>
<script>
  (function () {
    const openButtons = document.querySelectorAll('[data-modal-open]');
    const closeButtons = document.querySelectorAll('[data-modal-close]');

    function toggleModal(id, shouldOpen) {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.classList[shouldOpen ? 'add' : 'remove']('open');
    }

    openButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-modal-open');
        if (id) toggleModal(id, true);
      });
    });

    closeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-modal-close');
        if (id) toggleModal(id, false);
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) backdrop.classList.remove('open');
      });
    });
  })();
</script>
</body>
</html>
<?php
}
