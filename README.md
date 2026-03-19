# opencode-ag-auth-routes

Custom OpenCode configuration with patched `opencode-ag-auth` plugin featuring:

- **Auto-delete account on 403 ToS** — akun yang diblokir Google (Terms of Service violation) otomatis dihapus dari pool lokal dan request dihentikan dengan pesan jelas.
- **Pinned plugin version** — plugin dikunci ke versi stabil agar patch tidak hilang saat update.
- **patch-package integration** — perubahan custom pada plugin di-persist via patch file, auto-apply saat `npm install`.

---

## Cara Pakai

### 1. Clone repo ini

```bash
git clone https://github.com/GanishaMGN/opencode-ag-auth-routes.git
cd opencode-ag-auth-routes
```

### 2. Install dependencies

```bash
npm install
```

Perintah ini otomatis menjalankan `patch-package` via `postinstall` script, sehingga semua patch custom ter-apply ke `node_modules`.

### 3. Login akun Google Anda

```bash
opencode auth login
```

Tidak ada akun bawaan di repo ini. Setiap pengguna wajib login dengan akun Google-nya sendiri.

### 4. Jalankan OpenCode

```bash
opencode
```

---

## Struktur File Penting

```
.
├── opencode.json                      # Konfigurasi utama opencode (plugin, provider, model)
├── antigravity.json                   # Konfigurasi plugin opencode-ag-auth
├── antigravity-accounts.example.json  # Template struktur akun (kosong, tanpa token)
├── package.json                       # Dependencies + postinstall patch-package
├── patches/
│   └── opencode-ag-auth+1.6.3.patch  # Patch custom (delete_account_on_403_tos, dll)
└── .gitignore                         # Melindungi file sensitif agar tidak ter-commit
```

> `antigravity-accounts.json` (file akun asli dengan token) di-ignore oleh git. Dibuat otomatis saat login.

---

## Opsi Konfigurasi Custom

Semua opsi diatur di `antigravity.json`:

| Opsi | Nilai | Keterangan |
|------|-------|------------|
| `delete_account_on_403_tos` | `true` | Hapus akun otomatis jika kena blokir ToS Google |
| `auto_update` | `false` | Matikan auto-update plugin agar versi tetap terpasang |
| `switch_on_first_rate_limit` | `true` | Langsung pindah akun saat kena rate limit |
| `account_selection_strategy` | `hybrid` | Pemilihan akun berbasis health score |
| `scheduling_mode` | `cache_first` | Prioritas cache untuk efisiensi |

Untuk mematikan `delete_account_on_403_tos` (disable saja, tidak hapus):

```json
{
  "delete_account_on_403_tos": false
}
```

Atau via environment variable:

```bash
set OPENCODE_ANTIGRAVITY_DELETE_ACCOUNT_ON_403_TOS=0
```

---

## Rencana Upgrade Aman

### A. Update OpenCode (core)

1. Backup folder config
2. Update opencode
3. Jalankan `npm install` — patch auto-apply
4. Pastikan output: `opencode-ag-auth@1.6.3 ✔`
5. Test request model sekali

### B. Upgrade Plugin opencode-ag-auth ke versi baru

1. Edit `package.json` dan `opencode.json`, ganti versi (mis. `1.6.4`)
2. Jalankan `npm install`
3. Re-apply perubahan custom di `node_modules/opencode-ag-auth/dist/src/`
4. Regenerate patch:
   ```bash
   npx patch-package opencode-ag-auth
   ```
5. Commit patch baru:
   ```bash
   git add patches/
   git commit -m "update patch to opencode-ag-auth@1.6.4"
   ```

---

## Catatan Keamanan

- **Jangan commit** `antigravity-accounts.json` — file ini berisi token OAuth sensitif.
- File tersebut sudah di-ignore via `.gitignore`.
- Setiap pengguna harus login sendiri dengan `opencode auth login`.
- Jika akun terkena 403 ToS, ajukan banding (appeal) ke Google sebelum login ulang.

---

## Kontribusi

Pull request dan issue welcome di [github.com/GanishaMGN/opencode-ag-auth-routes](https://github.com/GanishaMGN/opencode-ag-auth-routes).
