/**
 * Sends a standardized and consistent JSON response envelope to the client.
 *
 * @param {object} res - Express Response object
 * @param {number} statusCode - HTTP status code
 * @param {boolean} success - Flag representing success or failure
 * @param {string} message - Human-readable summary message
 * @param {object|array|null} [data=null] - Payload content returning to the client
 * @param {object|array|null} [errors=null] - Validation error details or operational error arrays
 */
const sendResponse = (res, statusCode, success, message, data = null, errors = null) => {
  return res.status(statusCode).json({
    success,
    message,
    data,
    errors,
  });
};

module.exports = {
  sendResponse,
};
