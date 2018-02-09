/*!
 * Omelo
 * Copyright(c) 2012 xiechengchao <xiecc@163.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */
let fs = require('fs');
let path = require('path');
let application = require('./application');
let Package = require('../package');

/**
 * Expose `createApplication()`.
 *
 * @module
 */

let Omelo = module.exports = {};

/**
 * Framework version.
 */

Omelo.version = Package.version;

/**
 * Event definitions that would be emitted by app.event
 */
Omelo.events = require('./util/events');

/**
 * auto loaded components
 */
Omelo.components = {};

/**
 * auto loaded filters
 */
Omelo.filters = {};

/**
 * auto loaded rpc filters
 */
Omelo.rpcFilters = {};

/**
 * connectors
 */
Omelo.connectors = {};
Omelo.connectors.__defineGetter__('sioconnector', load.bind(null, './connectors/sioconnector'));
Omelo.connectors.__defineGetter__('hybridconnector', load.bind(null, './connectors/hybridconnector'));
Omelo.connectors.__defineGetter__('udpconnector', load.bind(null, './connectors/udpconnector'));
Omelo.connectors.__defineGetter__('mqttconnector', load.bind(null, './connectors/mqttconnector'));

/**
 * pushSchedulers
 */
Omelo.pushSchedulers = {};
Omelo.pushSchedulers.__defineGetter__('direct', load.bind(null, './pushSchedulers/direct'));
Omelo.pushSchedulers.__defineGetter__('buffer', load.bind(null, './pushSchedulers/buffer'));

let self = this;

/**
 * Create an omelo application.
 *
 * @return {Application}
 * @memberOf Omelo
 * @api public
 */
Omelo.createApp = function (opts) {
  let app = application;
  app.init(opts);
  self.app = app;
  return app;
};

/**
 * Get application
 */
Object.defineProperty(Omelo, 'app', {
  get:function () {
    return self.app;
  }
});

/**
 * Auto-load bundled components with getters.
 */
fs.readdirSync(__dirname + '/components').forEach(function (filename) {
  if (!/\.js$/.test(filename)) {
    return;
  }
  let name = path.basename(filename, '.js');
  let _load = load.bind(null, './components/', name);
  
  Omelo.components.__defineGetter__(name, _load);
  Omelo.__defineGetter__(name, _load);
});

fs.readdirSync(__dirname + '/filters/handler').forEach(function (filename) {
  if (!/\.js$/.test(filename)) {
    return;
  }
  let name = path.basename(filename, '.js');
  let _load = load.bind(null, './filters/handler/', name);
  
  Omelo.filters.__defineGetter__(name, _load);
  Omelo.__defineGetter__(name, _load);
});

fs.readdirSync(__dirname + '/filters/rpc').forEach(function (filename) {
  if (!/\.js$/.test(filename)) {
    return;
  }
  let name = path.basename(filename, '.js');
  let _load = load.bind(null, './filters/rpc/', name);
  
  Omelo.rpcFilters.__defineGetter__(name, _load);
});

function load(path, name) {
  if (name) {
    return require(path + name);
  }
  return require(path);
}
