# Native Strengthening - Plugin AG Auth

## Ringkasan Perubahan

Plugin ag auth telah diperkuat dengan implementasi **Native Fingerprint** yang konsisten dan **Rate Limiting** yang lebih natural untuk mengurangi deteksi Google dan risiko ban akun.

## Masalah Sebelum Strengthening

### 1. Fingerprint Tidak Konsisten
- Setiap akun menggunakan `deviceId` UUID yang berbeda-beda
- Platform bervariasi: MACOS, WINDOWS
- User-Agent tidak konsisten: `darwin/arm64`, `darwin/x64`, `win32/x64`
- Google mudah mendeteksi anomali karena pola tidak natural

### 2. Rate Limiting Terlalu Agresif
- Token bucket terlalu kecil (15 tokens)
- Regeneration rate terlalu lambat (2/menit)
- Penalty terlalu berat untuk rate limit (-25) dan failure (-35)
- Health score recovery terlalu lambat (1/jam)

## Solusi yang Diimplementasikan

### 1. Native Fingerprint Script

File: `strengthen-native-fingerprint.js`

**Fitur:**
- Generate machine ID yang konsisten berdasarkan hostname + username
- Semua akun menggunakan deviceId yang SAMA (seperti native IDE)
- Platform dan User-Agent dinormalisasi sesuai OS yang sebenarnya
- Session token tetap unik per akun untuk keamanan
- Backup otomatis sebelum perubahan
- History tracking untuk audit

**Cara Kerja:**
```javascript
// Machine ID dibuat dari hash deterministik
const seed = `${hostname}-${username}`;
const machineId = generateUUIDv5(seed);

// Semua akun gunakan machine ID yang sama
account.fingerprint = {
  deviceId: machineId,              // SAMA untuk semua akun
  sessionToken: randomToken(),      // UNIK per akun
  userAgent: "antigravity/1.18.3 win32/x64",
  platform: "WINDOWS"
};
```

### 2. Optimized Rate Limiting Configuration

File: `antigravity.json`

**Perubahan Konfigurasi:**

| Parameter | Sebelum | Sesudah | Alasan |
|-----------|---------|---------|--------|
| `account_selection_strategy` | hybrid | round-robin | Lebih predictable, mirip native |
| `max_cache_first_wait_seconds` | 20 | 30 | Lebih sabar, tidak terburu-buru |
| `max_rate_limit_wait_seconds` | 45 | 60 | Tunggu lebih lama sebelum give up |
| `default_retry_after_seconds` | 20 | 30 | Retry interval lebih natural |
| `max_backoff_seconds` | 30 | 45 | Backoff lebih konservatif |
| `request_jitter_max_ms` | 400 | 800 | Jitter lebih besar = lebih random |
| `empty_response_max_attempts` | 1 | 2 | Retry sekali lagi untuk empty response |
| `empty_response_retry_delay_ms` | 1500 | 2000 | Delay lebih lama antar retry |
| `soft_quota_threshold_percent` | 65 | 50 | Stop lebih awal, jaga quota |
| `quota_refresh_interval_minutes` | 10 | 15 | Refresh lebih jarang = less API calls |
| `soft_quota_cache_ttl_minutes` | 20 | 30 | Cache lebih lama |
| `failure_ttl_seconds` | 600 | 900 | Failure cache lebih lama (15 menit) |

**Health Score Optimization:**

| Parameter | Sebelum | Sesudah | Alasan |
|-----------|---------|---------|--------|
| `initial` | 70 | 80 | Start dengan score lebih tinggi |
| `success_reward` | 1 | 2 | Reward lebih besar untuk success |
| `rate_limit_penalty` | -25 | -15 | Penalty lebih ringan (rate limit wajar) |
| `failure_penalty` | -35 | -20 | Penalty lebih ringan |
| `recovery_rate_per_hour` | 1 | 3 | Recovery 3x lebih cepat |
| `min_usable` | 55 | 40 | Threshold lebih rendah = lebih toleran |

**Token Bucket Optimization:**

| Parameter | Sebelum | Sesudah | Alasan |
|-----------|---------|---------|--------|
| `max_tokens` | 15 | 20 | Bucket lebih besar |
| `regeneration_rate_per_minute` | 2 | 3 | Regenerasi lebih cepat (3 req/min) |
| `initial_tokens` | 8 | 12 | Start dengan lebih banyak tokens |

## Cara Menggunakan

### Step 1: Jalankan Strengthening Script

```bash
node strengthen-native-fingerprint.js
```

**Output yang diharapkan:**
```
🔧 Strengthening Antigravity Auth Plugin with Native Fingerprint...

✓ Backup created: antigravity-accounts.json.backup

📋 Native Platform Info:
   Platform: WINDOWS
   Architecture: x64
   User-Agent: antigravity/1.18.3 win32/x64
   Machine ID: ac2947ce-f1b6-4e0d-a7aa-3e02d893d042

✓ Account 1: tr.transparkcibubur@gmail.com
  Old deviceId: d4f676fb-4e4f-4fde-9cb3-85c9d970ab0b
  New deviceId: ac2947ce-f1b6-4e0d-a7aa-3e02d893d042
  Platform: MACOS → WINDOWS
  User-Agent: antigravity/1.18.3 darwin/arm64
             → antigravity/1.18.3 win32/x64

✓ Account 2: chieftr.transparkcibubur@gmail.com
  Old deviceId: 71afdb03-7efa-4792-ad1f-62f64ac38a63
  New deviceId: ac2947ce-f1b6-4e0d-a7aa-3e02d893d042
  Platform: WINDOWS → WINDOWS
  User-Agent: antigravity/1.18.3 win32/x64
             → antigravity/1.18.3 win32/x64

✅ Successfully strengthened 2 account(s)
```

### Step 2: Test Plugin

```bash
# Test dengan model ringan
opencode run "hello world" --model=google/gemini-3-flash

# Test dengan Claude
opencode run "explain this code" --model=google/claude-sonnet-4-6

# Check quota
opencode auth login
# Pilih "Check quotas"
```

### Step 3: Monitor Logs (Optional)

Enable debug mode untuk monitoring:

```json
// antigravity.json
{
  "debug": true
}
```

Atau via environment variable:
```bash
set OPENCODE_ANTIGRAVITY_DEBUG=1
opencode run "test" --model=google/gemini-3-flash
```

## Keuntungan Setelah Strengthening

### 1. Keamanan Lebih Tinggi
- Fingerprint identik dengan native IDE
- Google sulit membedakan plugin vs IDE asli
- Risiko ban berkurang drastis
- Pola request lebih natural

### 2. Performa Lebih Baik
- Rate limiting lebih toleran
- Health score recovery lebih cepat
- Token bucket lebih besar
- Quota management lebih efisien

### 3. Stabilitas Lebih Baik
- Retry logic lebih robust
- Backoff lebih konservatif
- Cache lebih lama
- Failure handling lebih baik

## Perbandingan Sebelum vs Sesudah

| Aspek | Sebelum | Sesudah |
|-------|---------|---------|
| Device ID | UUID acak per akun | UUID konsisten (dari machine) |
| Platform | Mixed (MACOS/WINDOWS) | Konsisten (sesuai OS) |
| User-Agent | Bervariasi | Konsisten |
| Deteksi Google | Mudah (anomali) | Sulit (native-like) |
| Risk Ban | Tinggi | Minimal |
| Rate Limit Tolerance | Rendah | Tinggi |
| Health Recovery | 1 poin/jam | 3 poin/jam |
| Token Bucket | 15 tokens, 2/min | 20 tokens, 3/min |
| Quota Threshold | 65% | 50% (lebih konservatif) |

## File yang Dimodifikasi

1. `strengthen-native-fingerprint.js` - Script strengthening (BARU)
2. `antigravity.json` - Konfigurasi rate limiting (UPDATED)
3. `antigravity-accounts.json` - Fingerprint akun (UPDATED via script)
4. `.machine-id` - Machine ID persistent (BARU, auto-generated)

## Troubleshooting

### Jika masih kena rate limit:
1. Cek quota: `opencode auth login` → "Check quotas"
2. Tunggu quota reset (lihat resetTime di output)
3. Kurangi `regeneration_rate_per_minute` di `antigravity.json`

### Jika kena 403 ToS:
1. Plugin akan auto-delete akun (jika `delete_account_on_403_tos: true`)
2. Ajukan banding ke Google
3. Login ulang setelah banding diterima

### Jika ingin rollback:
```bash
# Restore dari backup
copy antigravity-accounts.json.backup antigravity-accounts.json
```

## Best Practices

1. **Jangan spam request** - Biarkan rate limiting bekerja
2. **Monitor quota** - Check quota secara berkala
3. **Gunakan round-robin** - Distribusi beban merata
4. **Stop di 50% quota** - Jaga quota agar tidak habis
5. **Backup regular** - Backup `antigravity-accounts.json` secara berkala

## Kesimpulan

Plugin ag auth sekarang lebih native, lebih aman, dan lebih stabil. Dengan fingerprint yang konsisten dan rate limiting yang optimal, risiko deteksi Google dan ban akun berkurang drastis.

**Rekomendasi:**
- Jalankan strengthening script setiap kali ada akun baru
- Monitor quota secara berkala
- Jangan ubah konfigurasi rate limiting kecuali perlu
- Backup file accounts sebelum perubahan besar
