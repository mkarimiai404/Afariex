<?php
declare(strict_types=1);

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

date_default_timezone_set('Asia/Tehran');

const DB_HOST = 'localhost'; // اگر وصل نشد، این را به localhost تغییر دهید
const DB_NAME = 'ariansh6_afariex';
const DB_USER = 'ariansh6_afariex';
const DB_PASS = 'As&01015910';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    // خطای سینتکس اینجا برطرف شد
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function is_logged_in(): bool
{
    return isset($_SESSION['admin_id']) && (int)$_SESSION['admin_id'] > 0;
}

function require_login(): void
{
    if (!is_logged_in()) {
        header('Location: login.php');
        exit;
    }
}

function flash(string $type, string $message): void
{
    $_SESSION['flash'] = [
        'type' => $type,
        'message' => $message,
    ];
}

function get_flash(): ?array
{
    if (!isset($_SESSION['flash'])) {
        return null;
    }
    $flash = $_SESSION['flash'];
    unset($_SESSION['flash']);
    return $flash;
}

function e(?string $value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf_or_fail(?string $token): void
{
    $sessionToken = $_SESSION['csrf_token'] ?? '';
    if (!$token || !$sessionToken || !hash_equals($sessionToken, $token)) {
        http_response_code(419);
        exit('CSRF token mismatch');
    }
}

function current_role(): string
{
    return (string)($_SESSION['admin_role'] ?? 'viewer');
}

function can(string $permission): bool
{
    $role = current_role();
    $matrix = [
        'admin' => ['view', 'create', 'edit', 'delete'],
        'editor' => ['view', 'create', 'edit'],
        'viewer' => ['view'],
    ];
    $allowed = $matrix[$role] ?? ['view'];
    return in_array($permission, $allowed, true);
}

function require_permission(string $permission): void
{
    if (!can($permission)) {
        flash('error', 'شما دسترسی لازم برای این عملیات را ندارید.');
        header('Location: index.php');
        exit;
    }
}

function table_exists(string $tableName): bool
{
    $stmt = db()->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
    $stmt->execute([$tableName]);
    return (int)$stmt->fetchColumn() > 0;
}

function log_activity(string $action, string $entity, ?int $entityId = null, ?string $description = null): void
{
    if (!table_exists('activity_logs')) {
        return;
    }
    $stmt = db()->prepare('
        INSERT INTO activity_logs (user_id, action, entity, entity_id, description, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    ');
    $stmt->execute([
        (int)($_SESSION['admin_id'] ?? 0),
        $action,
        $entity,
        $entityId,
        $description,
    ]);
}

function jalali_date(?string $dateTime): string
{
    if (!$dateTime) return '-';
    try {
        if (class_exists(IntlDateFormatter::class)) {
            $formatter = new IntlDateFormatter(
                'fa_IR@calendar=persian',
                IntlDateFormatter::SHORT,
                IntlDateFormatter::SHORT,
                'Asia/Tehran',
                IntlDateFormatter::TRADITIONAL,
                'yyyy/MM/dd HH:mm'
            );
            $timestamp = strtotime($dateTime);
            if ($timestamp !== false) {
                $formatted = $formatter->format($timestamp);
                if ($formatted !== false) {
                    return (string)$formatted;
                }
            }
        }
    } catch (Throwable $e) {
    }
    return (string)$dateTime;
}

function to_jalali_datetime($date_string)
{
    if (empty($date_string)) return '';
    $formatter = new IntlDateFormatter(
        'fa_IR@calendar=persian',
        IntlDateFormatter::FULL,
        IntlDateFormatter::FULL,
        'Asia/Tehran',
        IntlDateFormatter::TRADITIONAL,
        'yyyy/MM/dd HH:mm:ss'
    );
    $timestamp = strtotime((string)$date_string);
    return $timestamp ? (string)$formatter->format($timestamp) : (string)$date_string;
}

function status_fa(string $status): string
{
    return match ($status) {
        'pending' => 'در انتظار',
        'approved' => 'تایید شده',
        'rejected' => 'رد شده',
        'paid' => 'پرداخت شده',
        'suspended' => 'تعلیق شده',
        default => $status,
    };
}

function normalize_persian_digits(string $value): string
{
    return strtr($value, [
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
        '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
        '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
    ]);
}

function jalali_input_to_gregorian_datetime(?string $value, bool $endOfDay = false): ?string
{
    $value = trim(normalize_persian_digits((string)$value));
    if ($value === '') {
        return null;
    }

    $value = str_replace('-', '/', $value);
    $suffix = $endOfDay ? ' 23:59:59' : ' 00:00:00';

    if (preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $value) && class_exists(IntlDateFormatter::class)) {
        try {
            $formatter = new IntlDateFormatter(
                'fa_IR@calendar=persian',
                IntlDateFormatter::NONE,
                IntlDateFormatter::NONE,
                'Asia/Tehran',
                IntlDateFormatter::TRADITIONAL,
                'yyyy/MM/dd'
            );
            $timestamp = $formatter->parse($value);
            if ($timestamp !== false) {
                return date('Y-m-d', $timestamp) . $suffix;
            }
        } catch (Throwable $e) {
        }
    }

    $timestamp = strtotime($value);
    if ($timestamp !== false) {
        return date('Y-m-d', $timestamp) . $suffix;
    }

    return null;
}

function export_xls_table(string $filename, array $headers, array $rows): void
{
    header('Content-Type: application/vnd.ms-excel; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    echo "\xEF\xBB\xBF";
    echo '<table border="1">';
    echo '<thead><tr>';
    foreach ($headers as $header) {
        echo '<th>' . e((string)$header) . '</th>';
    }
    echo '</tr></thead><tbody>';
    foreach ($rows as $row) {
        echo '<tr>';
        foreach ($row as $cell) {
            echo '<td>' . e((string)$cell) . '</td>';
        }
        echo '</tr>';
    }
    echo '</tbody></table>';
    exit;
}

function render_print_table_view(string $title, array $headers, array $rows, string $subtitle = ''): void
{
    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!doctype html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title><?= e($title) ?></title>
        <style>
            body {
                margin: 0;
                padding: 24px;
                background: #f8fafc;
                color: #111827;
                font-family: Tahoma, Arial, sans-serif;
                direction: rtl;
            }
            .print-sheet {
                max-width: 1200px;
                margin: 0 auto;
                background: #fff;
                border: 1px solid #dbe4ef;
                border-radius: 18px;
                box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
                overflow: hidden;
            }
            .print-header {
                padding: 22px 24px 14px;
                border-bottom: 1px solid #e5e7eb;
            }
            .print-header h1 {
                margin: 0;
                font-size: 22px;
                color: #0f172a;
            }
            .print-header p {
                margin: 8px 0 0;
                color: #64748b;
                font-size: 14px;
            }
            .print-table {
                width: 100%;
                border-collapse: collapse;
            }
            .print-table th,
            .print-table td {
                border: 1px solid #e5e7eb;
                padding: 12px 14px;
                text-align: right;
                vertical-align: middle;
                font-size: 13px;
            }
            .print-table th {
                background: #f8fafc;
                color: #334155;
                font-weight: 800;
            }
            .print-table tbody tr:nth-child(even) td {
                background: #fcfdff;
            }
            @media print {
                body {
                    background: #fff;
                    padding: 0;
                }
                .print-sheet {
                    box-shadow: none;
                    border: none;
                    border-radius: 0;
                }
            }
        </style>
    </head>
    <body>
        <div class="print-sheet">
            <div class="print-header">
                <h1><?= e($title) ?></h1>
                <?php if (trim($subtitle) !== ''): ?>
                    <p><?= e($subtitle) ?></p>
                <?php endif; ?>
            </div>
            <table class="print-table">
                <thead>
                    <tr>
                        <?php foreach ($headers as $header): ?>
                            <th><?= e((string)$header) ?></th>
                        <?php endforeach; ?>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($rows as $row): ?>
                        <tr>
                            <?php foreach ($row as $cell): ?>
                                <td><?= e((string)$cell) ?></td>
                            <?php endforeach; ?>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <script>
            window.onload = function () {
                window.print();
            };
        </script>
    </body>
    </html>
    <?php
    exit;
}
