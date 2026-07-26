const reportService = require('../services/reportService');

/**
 * Controller class managing the compilation and binary streaming of PDF report requests.
 */
class ReportController {
  /**
   * GET /api/v1/reports/commission/:recordId
   * Resolves commission record and streams binary PDF document.
   */
  downloadCommissionReport = async (req, res, next) => {
    try {
      const { recordId } = req.params;
      const { filename, buffer } = await reportService.generateCommissionReport(
        recordId,
        req.user,
        req.ip,
        req
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.end(buffer);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/reports/deduction/:recordId
   * Resolves deduction record and streams binary PDF document.
   */
  downloadDeductionReport = async (req, res, next) => {
    try {
      const { recordId } = req.params;
      const { filename, buffer } = await reportService.generateDeductionReport(
        recordId,
        req.user,
        req.ip,
        req
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.end(buffer);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/reports/combined/:commissionId/:deductionId
   * Resolves both commission and deduction records and streams a consolidated PDF document.
   */
  downloadCombinedReport = async (req, res, next) => {
    try {
      const { commissionId, deductionId } = req.params;
      const { filename, buffer } = await reportService.generateCombinedReport(
        commissionId,
        deductionId,
        req.user,
        req.ip,
        req
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.end(buffer);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/reports/bulk-payslips
   * Generates and streams a ZIP file containing all individual payslips for the latest upload/active batch.
   */
  downloadBulkPayslips = async (req, res, next) => {
    try {
      const { batchId } = req.query;
      const { filename, buffer } = await reportService.generateBulkPayslipsZip(
        batchId || null,
        req.user,
        req.ip,
        req
      );

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.end(buffer);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new ReportController();

