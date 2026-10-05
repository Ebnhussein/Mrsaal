// Express 4 does not forward rejected promises from async handlers automatically.
module.exports = handler => (req, res, next) => {
  return Promise.resolve().then(() => handler(req, res, next)).catch(next);
};
