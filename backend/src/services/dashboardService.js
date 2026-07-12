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

    let sqlDump = `-- Mawar Teraju Central central Database Backup\n`;
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
      filename: `mawar_backup_${Date.now()}.sql`,
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

    await auditLogService.logSuccessLogin(user.id, req, { action: 'SYSTEM_MONITOR' });

    return {
      system: {
        platform: os.platform(),
        release: os.release(),
        uptime: os.uptime(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        cpuCores: os.cpus().length
      },
      node: {
        uptime: process.uptime(),
        memoryHeapUsed: memoryUsage.heapUsed,
        memoryHeapTotal: memoryUsage.heapTotal,
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
