const penaltyService = require('../services/penaltyService');
const { sendResponse } = require('../utils/response');

/**
 * Controller class coordinating penalty Excel file uploads and searches.
 */
class PenaltyController {
  /**
   * POST /api/v1/penalty/upload
   */
  uploadPenalty = async (req, res, next) => {
    try {
      if (!req.file) {
        return sendResponse(res, 400, false, 'No file uploaded. Sila pilih fail Excel.', null, [], 'UPLOAD_MISSING_FILE');
      }

      const result = await penaltyService.importPenalty(
        req.file.buffer,
        req.file.originalname,
        req.user.id,
        req
      );

      return sendResponse(res, 201, true, 'Penalty Excel imported successfully.', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/penalty/search
   */
  searchPenalties = async (req, res, next) => {
    try {
      const { dispatcher_id } = req.query;
      const records = await penaltyService.searchPenalties(dispatcher_id);
      return sendResponse(res, 200, true, 'Penalty records retrieved successfully.', { records });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new PenaltyController();
