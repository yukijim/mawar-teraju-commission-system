/**
 * Sends a standardized and consistent JSON response envelope.
 * Error responses enforce the inclusion of a programmatic "code" field.
 *
 * @param {object} res - Express Response object
 * @param {number} statusCode - HTTP status code
 * @param {boolean} success - Flag representing success or failure
 * @param {string} message - Human-readable summary message
 * @param {object|array|null} [data=null] - Payload content returning to the client (Success responses only)
 * @param {object|array|null} [errors=null] - Validation error details or operational error arrays (Error responses only)
 * @param {string|null} [code=null] - Programmatic error code (e.g. 'AUTH_INVALID_CREDENTIALS') (Error responses only)
 */
const sendResponse = (res, statusCode, success, message, data = null, errors = null, code = null) => {
  const payload = {
    success,
    message,
  };

  if (success) {
    payload.data = data;
  } else {
    // Errors must include programmatic code and errors array
    payload.code = code || 'INTERNAL_SERVER_ERROR';
    payload.errors = errors || [];
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  sendResponse,
};
