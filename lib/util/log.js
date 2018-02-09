let logger = require('omelo-logger');

/**
 * Configure omelo logger
 */
module.exports.configure = function(app, filename) {
  let serverId = app.getServerId();
  let base = app.getBase();
  logger.configure(filename, {serverId: serverId, base: base});
};
