# Mawar Teraju Design System (Enterprise Light Theme v1.2.0-beta)

Dokumen ini mentakrifkan sistem reka bentuk (Design System) bagi projek **Commission Lookup System (Mawar Teraju)**. Semua komponen visual, susun atur, tipografi, warna semantik, dan cetakan mematuhi token yang ditakrifkan di bawah demi memastikan konsistensi visual SaaS profesional dan pematuhan aksesibiliti minimum WCAG AA.

---

## 1. Token Warna (Color Tokens)

Warna sistem berpusat di dalam pemboleh ubah `:root` CSS pada [styles.css](file:///c:/_MT%20Sistem%20Com/styles.css). Tiada warna *hardcoded* dibenarkan di dalam kod komponen.

| Token | Nilai Hex / RGBA | Kegunaan Utama |
| :--- | :--- | :--- |
| `--bg-main` | `#F8FAFC` | Latar belakang halaman utama (off-white). |
| `--bg-card` | `#FFFFFF` | Latar belakang kad, modal, dan borang. |
| `--bg-card-hover` | `#F1F5F9` | Latar belakang hover kad, baris jadual, dan elemen interaktif. |
| `--bg-secondary` | `#F1F5F9` | Latar belakang kontainer dalaman, progress bar track. |
| `--border-color` | `#CBD5E1` | Garisan sempadan kelabu lembut (Slate 300) untuk pembahagian bersih. |
| `--primary` | `#8E1B32` | Maroon rasmi Mawar Teraju (Header, butang utama, tab aktif). |
| `--primary-hover` | `#711528` | Maroon gelap untuk kesan hover elemen utama. |
| `--accent` | `#D4AF37` | Gold rasmi Mawar Teraju (Status penanda draf, badge amaran). |
| `--text-primary` | `#0F172A` | Teks utama Slate 900 (Kontras tinggi untuk kebolehbacaan). |
| `--text-subtitle` | `#334155` | Teks sub-header Slate 700 (Welcome subtitle, modal header). |
| `--text-secondary` | `#475569` | Teks maklumat sekunder Slate 600. |
| `--text-placeholder` | `#64748B` | Placeholder form input dan teks muted (Slate 500). |
| `--success` | `#16A34A` | Hijau semantik (Badge status diterbit, ikon sukses). |
| `--warning` | `#F59E0B` | Kuning/Amber semantik (Badge status draf). |
| `--danger` | `#DC2626` | Merah semantik (Butang padam log, ralat fail, status archived). |
| `--info` | `#2563EB` | Biru semantik (Badge info, pautan sekunder). |

---

## 2. Skala Tipografi (Typography Scale)

Sistem menggunakan gabungan font heading **Outfit** (moden dan berstruktur) dan font body **Plus Jakarta Sans** (bersih dan sangat mudah dibaca).

*   **Heading 1 (`--text-4xl` / `2.25rem`)**: welcome titles pada selection screens.
*   **Heading 2 (`--text-3xl` / `1.75rem`)**: judul utama view (`.view-title h2`, nama rider).
*   **Heading 3 (`--text-2xl` / `1.5rem`)**: sub-judul bahagian/kad besar.
*   **Body Base (`--text-base` / `0.95rem`)**: saiz teks utama bagi perenggan dan input borang.
*   **Body Small (`--text-sm` / `0.875rem`)**: saiz teks jadual, kapsyen sekunder, dan label.
*   **Micro / Meta (`--text-xs` / `0.75rem`)**: status badge, tarikh kemas kini, saiz fail.

---

## 3. Skala Jarak & Spacing (Spacing System)

Jarak dibina secara berkadar (proportional) berasaskan sistem grid enterprise.

*   `--space-2xs` (`4px`): Jarak mikro antara teks dan ikon kecil.
*   `--space-xs` (`8px`): Padding dalaman butang kecil, margin elemen sebaris.
*   `--space-sm` (`12px`): Padding jadual, gap tab bar, margin item senarai.
*   `--space-md` (`16px`): Padding kad statistik, gap grid dashboard, margin borang.
*   `--space-lg` (`24px`): Padding kad utama, jarak antara segmen carian.
*   `--space-xl` (`32px`): Padding upload dropzone, margin atas modal.
*   `--space-2xl` (`48px`): Jarak luar welcome page header ke grid.

---

## 4. Perpustakaan Komponen Teras (Component Library Guidelines)

### A. Kad Dashboard (`.card`)
*   Latar belakang `#FFFFFF`, sempadan `#CBD5E1` (`1px solid`), tanpa glassmorphism gelap.
*   Menggunakan bayang-bayang nipis (`box-shadow: var(--shadow-sm)`).
*   Pada keadaan hover, sempadan bertukar kepada maroon lembut (`var(--primary-glow)`) dengan bayang-bayang sederhana (`var(--shadow-md)`).

### B. Butang (`.btn`)
*   **Primary (`.btn-primary`)**: Maroon padat (`#8E1B32`), teks Putih (`#ffffff`).
*   **Secondary (`.btn-secondary`)**: Latar belakang Putih, teks Maroon, border Maroon (`1px solid var(--primary)`). Kesan hover menukarkan latar belakang kepada maroon ultra-ringan (`rgba(142, 27, 50, 0.05)`).
*   **Danger (`.btn-danger`)**: Merah padat (`#DC2626`), teks Putih.

### C. Input Borang (`.form-control`)
*   Latar belakang putih (`#ffffff`), sempadan `#CBD5E1`, focus outline menggunakan Maroon (`var(--primary)`) dengan glow bulatan `rgba(142, 27, 50, 0.1)`.
*   Placeholder berwarna kelabu sederhana `#64748B`.

### D. Jadual Data (`.data-table`)
*   **Header**: Latar belakang Maroon, teks Putih, teks tebal (`font-weight: 600`).
*   **Baris**: Baris selang-seli berwarna putih `#ffffff` dan off-white `#F8FAFC`.
*   **Hover**: Baris bertukar kepada warna `#F1F5F9` semasa kursor melintasi jadual.

---

## 5. Piawaian Aksesibiliti & Cetakan (Accessibility & Print Standards)

*   **WCAG AA Compliance**: Semua kombinasi teks dan warna latar belakang mesti melepasi nisbah kontras **4.5:1** (kecuali teks hiasan / besar yang dibenarkan pada 3:1).
*   **Gaya Cetakan (`@media print`)**:
    *   Latar belakang laman bertukar kepada putih kertas secara automatik.
    *   Pengepala khas `.print-only-header` diaktifkan untuk memaparkan tarikh dan logo rasmi Mawar Teraju.
    *   Elemen bukan bercetak (butang, tab, sidebar admin) disembunyikan sepenuhnya.
