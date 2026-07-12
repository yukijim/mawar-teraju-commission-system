const uploadService = require('../services/uploadService');
const { sendResponse } = require('../utils/response');

/**
 * Controller class coordinating Excel file uploads and parsing queries.
 */
class UploadController {
  /**
   * POST /api/v1/upload/commission
   * Parses Commission sheet and bulk inserts mappings and commission records.
   */
  uploadCommission = async (req, res, next) => {
    try {
      if (!req.file) {
        return sendResponse(res, 400, false, 'No file uploaded. Sila pilih fail Excel.', null, [], 'UPLOAD_MISSING_FILE');
      }

      const result = await uploadService.importCommission(
        req.file.buffer,
        req.file.originalname,
        req.user.id,
        req.body,
        req
      );

      return sendResponse(res, 201, true, 'Commission Excel batch imported successfully.', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/upload/deduction
   * Parses Deduction details sheet and bulk inserts deduction records.
   */
  uploadDeduction = async (req, res, next) => {
    try {
      if (!req.file) {
        return sendResponse(res, 400, false, 'No file uploaded. Sila pilih fail Excel.', null, [], 'UPLOAD_MISSING_FILE');
      }

      const result = await uploadService.importDeduction(
        req.file.buffer,
        req.file.originalname,
        req.user.id,
        req.body,
        req
      );

      return sendResponse(res, 201, true, 'Deduction Excel batch imported successfully.', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/upload/history
   * Retrieves all imported batches list.
   */
  getUploadHistory = async (req, res, next) => {
    try {
      const history = await uploadService.getUploadHistory();
      return sendResponse(res, 200, true, 'Upload history retrieved successfully.', { history });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/upload/:batchId
   * Retrieves specific batch metadata and linked records.
   */
  getBatchDetails = async (req, res, next) => {
    try {
      const { batchId } = req.params;
      const details = await uploadService.getBatchDetails(batchId);
      return sendResponse(res, 200, true, 'Batch details retrieved successfully.', details);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new UploadController();
