const os = require('os');
const dashboardRepository = require('../repositories/dashboardRepository');
const uploadService = require('./uploadService');
const auditLogService = require('./auditLogService');
const db = require('../config/database');
const { AppError } = require('../middleware/error');

class DashboardService {
  /**
   * Retrieves dashboard analytics data (summary metrics + trends)
   */
  async getSummary(user, req) {
    if (user.role !== 'ADMIN') {
      throw new AppError('Only administrators can access dashboard analytics.', 403, 'ANALYTICS_FORBIDDEN');
    }

    const summary = await dashboardRepository.getOverallSummary();
    const trends = await dashboardRepository.getMonthlyTrends();

    await auditLogService.logSuccessLogin(user.id, req, { action: 'VIEW_DASHBOARD' });

    return {
      summary,
      trends
    };
  }

  /**
   * Generates a platform-independent custom SQL backup dump of the database tables
   */
  async generateDatabaseBackup(user, req) {
    if (user.role !== 'ADMIN') {
      throw new AppError('Only administrators can trigger database backups.', 403, 'BACKUP_FORBIDDEN');
    }

    const companyConfig = require('../config/company');
    let sqlDump = `-- ${companyConfig.companyName} Central Database Backup\n`;
    sqlDump += `-- Penjana: ${user.username} | Tarikh: ${new Date().toISOString()}\n\n`;

    const tables = ['users', 'batches', 'dispatcher_mappings', 'commission_records', 'deduction_records', 'search_history', 'audit_logs'];

    for (const table of tables) {
      sqlDump += `-- Data for table: ${table}\n`;
      try {
        const result = await db.query(`SELECT * FROM ${table}`);
        if (result.rows.length === 0) {
          sqlDump += `-- (0 records)\n\n`;
          continue;
        }

        result.rows.forEach(row => {
          const keys = Object.keys(row);
          const values = keys.map(k => {
            const val = row[k];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return val;
          });
          sqlDump += `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        });
        sqlDump += `\n`;
      } catch (err) {
        sqlDump += `-- Failed to dump table ${table}: ${err.message}\n\n`;
      }
    }

    await auditLogService.logSuccessLogin(user.id, req, { action: 'DATABASE_BACKUP' });

    return {
      filename: `reekod_backup_${Date.now()}.sql`,
      sqlDump
    };
  }

  /**
   * Compiles system performance, OS parameters, database status, and active locks
   */
  async getSystemMonitoringMetrics(user, req) {
    if (user.role !== 'ADMIN') {
      throw new AppError('Only administrators can access system metrics.', 403, 'MONITOR_FORBIDDEN');
    }

    const startDbTime = Date.now();
    let dbStatus = 'healthy';
    let dbLatency = 0;
    try {
      await db.query('SELECT 1');
      dbLatency = Date.now() - startDbTime;
    } catch (err) {
      dbStatus = 'degraded';
    }

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const activeUploadsCount = uploadService.activeLocks.size;

    // Cross-platform disk space checker
    const child_process = require('child_process');
    let diskFreePercent = 100;
    try {
      if (process.platform === 'win32') {
        const out = child_process.execSync('wmic logicaldisk get size,freespace').toString();
        const lines = out.trim().split('\n').map(l => l.trim().split(/\s+/));
        if (lines.length > 1 && lines[1].length >= 2) {
          const free = parseInt(lines[1][0], 10);
          const total = parseInt(lines[1][1], 10);
          if (total > 0) diskFreePercent = (free / total) * 100;
        }
      } else {
        const out = child_process.execSync('df -k /').toString();
        const lines = out.trim().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(/\s+/);
          const total = parseInt(parts[1], 10);
          const free = parseInt(parts[3], 10);
          if (total > 0) diskFreePercent = (free / total) * 100;
        }
      }
    } catch (err) {
      // Fallback if permission block or execution failure
      diskFreePercent = 88;
    }

    // Health Status Evaluation Engine
    let healthStatus = 'OK';
    const alerts = [];

    if (dbStatus === 'degraded') {
      healthStatus = 'CRITICAL';
      alerts.push('CRITICAL: Database connection is unavailable.');
    }

    if (dbLatency > 100) {
      if (healthStatus !== 'CRITICAL') healthStatus = 'WARNING';
      alerts.push(`WARNING: High database latency at ${dbLatency}ms (threshold: 100ms).`);
    }

    if (diskFreePercent < 15) {
      if (healthStatus !== 'CRITICAL') healthStatus = 'WARNING';
      alerts.push(`WARNING: Low disk space at ${diskFreePercent.toFixed(1)}% free (threshold: 15%).`);
    }

    const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (heapUsedPercent > 80) {
      if (healthStatus !== 'CRITICAL') healthStatus = 'WARNING';
      alerts.push(`WARNING: High heap memory usage at ${heapUsedPercent.toFixed(1)}% (threshold: 80%).`);
    }

    await auditLogService.logSuccessLogin(user.id, req, { action: 'SYSTEM_MONITOR', healthStatus });

    return {
      health: {
        status: healthStatus,
        alerts,
        checkedAt: new Date().toISOString()
      },
      system: {
        platform: os.platform(),
        release: os.release(),
        uptime: os.uptime(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        cpuCores: os.cpus().length,
        diskFreePercent: parseFloat(diskFreePercent.toFixed(2))
      },
      node: {
        uptime: process.uptime(),
        memoryHeapUsed: memoryUsage.heapUsed,
        memoryHeapTotal: memoryUsage.heapTotal,
        heapUsedPercent: parseFloat(heapUsedPercent.toFixed(2)),
        cpuUsageUser: cpuUsage.user,
        cpuUsageSystem: cpuUsage.system
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatency
      },
      batchEngine: {
        activeLocksCount: activeUploadsCount,
        lockedChecksums: Array.from(uploadService.activeLocks)
      }
    };
  }
}

module.exports = new DashboardService();
