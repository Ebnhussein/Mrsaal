'use strict';

module.exports = function asyncHandler(handler) {
  return function (req, res, next) {
    return Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
};
