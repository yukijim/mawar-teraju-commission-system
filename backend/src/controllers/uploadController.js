const uploadService = require('../services/uploadService');
const { sendResponse } = require('../utils/response');

/**
 * Controller class coordinating Excel file uploads and parsing queries.
 * Expanded to manage Enterprise Batch Management workflows.
 */
class UploadController {
  /**
   * POST /api/v1/upload/commission
   * Parses Commission sheet and bulk inserts mappings and commission records in DRAFT status.
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

      return sendResponse(res, 201, true, 'Commission Excel batch imported as DRAFT successfully.', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/upload/deduction
   * Parses Deduction details sheet and bulk inserts deduction records in DRAFT status.
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

      return sendResponse(res, 201, true, 'Deduction Excel batch imported as DRAFT successfully.', result);
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

  /**
   * GET /api/v1/upload/progress/:batchId
   * Retrieves the current upload/import progress percentage and status of a batch.
   */
  getUploadProgress = async (req, res, next) => {
    try {
      const { batchId } = req.params;
      const progressData = await uploadService.getProgress(batchId);
      return sendResponse(res, 200, true, 'Upload progress retrieved successfully.', progressData);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/upload/publish/:batchId
   * Publishes an imported draft batch, deactivating other published batches in the same month/year.
   */
  publishBatch = async (req, res, next) => {
    try {
      const { batchId } = req.params;
      const updatedBatch = await uploadService.publishBatch(batchId, req.user.id, req);
      return sendResponse(res, 200, true, 'Batch published and activated successfully.', { batch: updatedBatch });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/upload/rollback/:batchId
   * Rolls back an active published batch to its linked previous_batch_id version.
   */
  rollbackBatch = async (req, res, next) => {
    try {
      const { batchId } = req.params;
      const result = await uploadService.rollbackBatch(batchId, req.user.id, req);
      return sendResponse(res, 200, true, 'Batch rollback successfully executed.', result);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new UploadController();
