#!/bin/bash
# REEKOD Semak PostgreSQL Backup Automation Script
# Location: /opt/reekod/scripts/backup.sh
# Scheduled via Cron: 0 2 * * * (Every day at 2:00 AM)

# Exit immediately if a command exits with a non-zero status
set -e

# Load PostgreSQL variables
DB_NAME=${DATABASE_NAME:-"reekod_commission"}
DB_USER=${DATABASE_USER:-"postgres"}
DB_PASSWORD=${DATABASE_PASSWORD}
BACKUP_DIR="/var/backups/reekod-semak"
DATE=$(date +\%Y-\%m-\%d_\%H-\%M-\%S)
FILENAME="${BACKUP_DIR}/db_backup_${DATE}.sql.gz"

echo "[Backup Init] Starting PostgreSQL automated backup for ${DB_NAME} at $(date)"

# Create local backup directory if missing
mkdir -p "${BACKUP_DIR}"

# 1. Run pg_dump compression
export PGPASSWORD="${DB_PASSWORD}"
pg_dump -h localhost -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${FILENAME}"
echo "[Backup Success] Local backup archive saved to ${FILENAME}"

# 2. Off-site replication copy (Replicates archive to offsite storage)
# Example S3 copy command (Requires AWS CLI configured on the VPS)
# aws s3 cp "${FILENAME}" "s3://reekod-backups/database/db_backup_${DATE}.sql.gz"
echo "[Backup Replicating] (Placeholder) Replicating archive to off-site cloud storage bucket..."

# 3. Enforce Retention Policy (Keep daily backups for 30 days, purge older files)
echo "[Retention Policy] Purging backups older than 30 days from ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -name "db_backup_*.sql.gz" -mtime +30 -exec rm {} \;
echo "[Backup Done] Database backup workflow successfully completed."
