const searchService = require('../services/searchService');
const { sendResponse } = require('../utils/response');

/**
 * Controller class coordinating the Enterprise Commission Search queries.
 */
class SearchController {
  /**
   * GET /api/v1/search
   * Performs securely filtered carian queries, paginate, and returns payload.
   */
  searchCommissions = async (req, res, next) => {
    try {
      const results = await searchService.executeSearch(req.user, req.query, req.ip, req);
      return sendResponse(res, 200, true, 'Commission records retrieved successfully.', results);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/search/history
   * Retrieves log histories of search query events for administrators.
   */
  getSearchHistory = async (req, res, next) => {
    try {
      const logs = await searchService.getSearchHistory(req.user, req);
      return sendResponse(res, 200, true, 'Search history log retrieved successfully.', { logs });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/search/export/pdf
   * Architecture hook preparing PDF exports downloads.
   */
  exportPdf = async (req, res, next) => {
    try {
      const { recordId } = req.query;
      const exportPackage = searchService.preparePdfExport({ id: recordId });
      return sendResponse(res, 200, true, 'PDF Export payload prepared successfully.', exportPackage);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/search/export/excel
   * Architecture hook preparing Excel spreadsheet exports.
   */
  exportExcel = async (req, res, next) => {
    try {
      const exportPackage = searchService.prepareExcelExport([]);
      return sendResponse(res, 200, true, 'Excel Export payload prepared successfully.', exportPackage);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new SearchController();
