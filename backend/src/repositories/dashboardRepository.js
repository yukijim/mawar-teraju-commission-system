const db = require('../config/database');

/**
 * Repository layer executing optimized queries for the Dashboard Analytics.
 */
class DashboardRepository {
  /**
   * Retrieves overall financial summary metrics across all published batches
   */
  async getOverallSummary() {
    const text = `
      SELECT 
        COALESCE(SUM(c.final_amount_to_pay), 0) as total_payouts,
        COALESCE(AVG(c.total_commission), 0) as avg_commission,
        COUNT(DISTINCT c.dispatcher_id) as total_dispatchers,
        COALESCE(SUM(c.deduction_hq_penalty + c.deduction_advance + c.deduction_pending_cod + c.deduction_duitnow_penalty + c.deduction_late_cod_penalty + c.deduction_lost_individual + c.deduction_lost_parcel_hub), 0) as total_deductions
      FROM commission_records c
      WHERE c.batch_id IN (
        SELECT id FROM batches WHERE status = 'PUBLISHED' AND deleted_at IS NULL
      )
    `;
    const result = await db.query(text);
    return {
      totalPayouts: parseFloat(result.rows[0].total_payouts),
      avgCommission: parseFloat(result.rows[0].avg_commission),
      totalDispatchers: parseInt(result.rows[0].total_dispatchers, 10),
      totalDeductions: parseFloat(result.rows[0].total_deductions)
    };
  }

  /**
   * Retrieves comparative monthly trends over published batches
   */
  async getMonthlyTrends() {
    const text = `
      SELECT 
        b.year, 
        b.month,
        COALESCE(SUM(c.final_amount_to_pay), 0) as total_payouts,
        COUNT(DISTINCT c.dispatcher_id) as total_dispatchers,
        COALESCE(SUM(c.deduction_hq_penalty + c.deduction_advance + c.deduction_pending_cod + c.deduction_duitnow_penalty + c.deduction_late_cod_penalty + c.deduction_lost_individual + c.deduction_lost_parcel_hub), 0) as total_deductions
      FROM batches b
      LEFT JOIN commission_records c ON b.id = c.batch_id
      WHERE b.status = 'PUBLISHED' AND b.deleted_at IS NULL
      GROUP BY b.year, b.month
      ORDER BY b.year DESC, b.month DESC
      LIMIT 12
    `;
    const result = await db.query(text);
    return result.rows.map(r => ({
      year: r.year,
      month: r.month,
      totalPayouts: parseFloat(r.total_payouts),
      totalDispatchers: parseInt(r.total_dispatchers, 10),
      totalDeductions: parseFloat(r.total_deductions)
    }));
  }
}

module.exports = new DashboardRepository();
