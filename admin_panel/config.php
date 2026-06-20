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
        default => $status,
    };
}
