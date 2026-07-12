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
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
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
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.end(buffer);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new ReportController();
