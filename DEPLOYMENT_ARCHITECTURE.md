# Deployment & Cloud Infrastructure Architecture

Dokumen ini memperincikan pelan seni bina deployment pengeluaran (production environment), konfigurasi reverse-proxy, persediaan container bagi pembangunan tempatan, serta strategi sandaran dan pemulihan data (backup & recovery).

---

## 1. Seni Bina Infrastruktur Pengeluaran (Production Deployment Topology)

Sistem ini dicadangkan untuk dihoskan di atas persekitaran cloud VPS (contoh: DigitalOcean, AWS EC2, atau Linode) dengan pembahagian trafik seperti berikut:

```text
               Internet (HTTPS / Port 443)
                          │
                          ▼
                  ┌───────────────┐
                  │ Nginx Proxy   │ (SSL/TLS Termination)
                  └───────┬───────┘
                          │
          ┌───────────────┴───────────────┐
          ▼ (Static files)                ▼ (API requests / Port 3000)
    ┌─────────────┐                 ┌─────────────┐
    │ Frontend UI │                 │ Node.js API │ (Running under PM2)
    └─────────────┘                 └──────┬──────┘
                                           │ (Postgres pool connection)
                                           ▼
                                    ┌─────────────┐
                                    │ PostgreSQL  │ (Localhost Port 5432)
                                    └─────────────┘
```

### Komponen Pengeluaran:
1.  **Nginx (Reverse Proxy & Web Server)**:
    *   Menerima trafik awam HTTPS, menguruskan sijil SSL (Let's Encrypt), dan menghantar permintaan static (HTML, CSS, JS) secara langsung.
    *   Menghantar API request (`/api/*`) ke backend Node.js yang berjalan secara dalaman di port `3000`.
2.  **Node.js Process Manager (PM2)**:
    *   Mengurus proses runtime pelayan Node.js.
    *   Menghidupkan semula aplikasi secara automatik jika berlaku kegagalan memori (*crash*), dan menguruskan log sistem.
3.  **PostgreSQL (Database Server)**:
    *   Dihoskan secara tempatan di dalam VPS yang sama (akses disekat di port 5432 kepada localhost sahaja) atau menggunakan Managed Database Service (seperti AWS RDS) untuk skalabiliti dan backup automatik.

---

## 2. Persediaan Persekitaran Tempatan (Local Docker Setup)

Bagi memudahkan pembangunan tempatan tanpa perlu memasang PostgreSQL secara manual pada sistem hos Windows/MacOS, fail konfigurasi `docker-compose.yml` disediakan untuk melancarkan pangkalan data PostgreSQL secara automatik dalam satu arahan.

### Fail Konfigurasi `docker-compose.yml` (Cadangan):
```yaml
version: '3.8'

services:
  postgres_db:
    image: postgres:15-alpine
    container_name: mawar_postgres
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: mawar_secure_db_pass
      POSTGRES_DB: mawar_teraju_comm
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
    driver: local
```

*Arahan untuk menjalankan pangkalan data tempatan:*
```bash
docker-compose up -d
```

---

## 3. Strategi Sandaran & Pemulihan (Backup & Recovery)

Penyimpanan data dispatcher dan komisen sangat kritikal. Dua kaedah sandaran ditakrifkan:

### A. Autopilot Backup bulanan & Harian (Server SQL Dump)
Skrip cron job linux harian dijadualkan untuk mengekspot struktur dan data PostgreSQL ke dalam fail `.sql` yang dimampatkan:

```bash
#!/bin/bash
# Skrip backup postgres harian
BACKUP_DIR="/var/backups/mawar-teraju"
DB_NAME="mawar_teraju_comm"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/mawar_backup_${DATE}.sql.gz"

# Jalankan dump dan mampatkan fail
pg_dump -h localhost -U postgres ${DB_NAME} | gzip > ${FILENAME}

# Hapus backup yang melebihi 30 hari untuk jimat memori
find ${BACKUP_DIR} -type f -name "*.sql.gz" -mtime +30 -delete
```

### B. Pemulihan Data Pantas (Recovery Script)
Untuk memulihkan pangkalan data daripada fail backup sekiranya berlaku kegagalan perkakasan:

```bash
# 1. Nyah-mampat fail backup
gunzip mawar_backup_20260711_120000.sql.gz

# 2. Masukkan semula data ke dalam pangkalan data PostgreSQL
psql -h localhost -U postgres -d mawar_teraju_comm -f mawar_backup_20260711_120000.sql
```
