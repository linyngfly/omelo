/**
 * Component for server starup.
 */
let Server = require('../server/server');

/**
 * Component factory function
 *
 * @param {Object} app  current application context
 * @return {Object}     component instance
 */
module.exports = function(app, opts) {
	return new Component(app, opts);
};

/**
 * Server component class
 *
 * @param {Object} app  current application context
 */
let Component = function(app, opts) {
	this.server = Server.create(app, opts);
};

let pro = Component.prototype;

pro.name = '__server__';

/**
 * Component lifecycle callback
 *
 * @param {Function} cb
 * @return {Void}
 */
pro.start = function(cb) {
	this.server.start();
	process.nextTick(cb);
};

/**
 * Component lifecycle callback
 *
 * @param {Function} cb
 * @return {Void}
 */
pro.afterStart = function(cb) {
	this.server.afterStart();
	process.nextTick(cb);
};

/**
 * Component lifecycle function
 *
 * @param {Boolean}  force whether stop the component immediately
 * @param {Function}  cb
 * @return {Void}
 */
pro.stop = function(force, cb) {
	this.server.stop();
	process.nextTick(cb);
};

/**
 * Proxy server handle
 */
pro.handle = function(msg, session, cb) {
	this.server.handle(msg, session, cb);
};

/**
 * Proxy server global handle
 */
pro.globalHandle = function(msg, session, cb) {
	this.server.globalHandle(msg, session, cb);
};