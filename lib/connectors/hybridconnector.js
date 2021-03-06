let net = require('net');
let tls = require('tls');
let util = require('util');
let EventEmitter = require('events').EventEmitter;

let HybridSocket = require('./hybridsocket');
let Switcher = require('./hybrid/switcher');
let Handshake = require('./commands/handshake');
let Heartbeat = require('./commands/heartbeat');
let Kick = require('./commands/kick');
let coder = require('./common/coder');

let curId = 1;

/**
 * Connector that manager low level connection and protocol bewteen server and client.
 * Develper can provide their own connector to switch the low level prototol, such as tcp or probuf.
 */
let Connector = function(port, host, opts) {
  if (!(this instanceof Connector)) {
    return new Connector(port, host, opts);
  }

  EventEmitter.call(this);

  this.opts = opts || {};
  this.port = port;
  this.host = host;
  this.useDict = opts.useDict;
  this.useProtobuf = opts.useProtobuf;
  this.handshake = new Handshake(opts);
  this.heartbeat = new Heartbeat(opts);
  this.distinctHost = opts.distinctHost;
  this.ssl = opts.ssl;

  this.switcher = null;
};

util.inherits(Connector, EventEmitter);

module.exports = Connector;

/**
 * Start connector to listen the specified port
 */
Connector.prototype.start = function(cb) {
  let app = require('../omelo').app;
  let self = this;

  let gensocket = function(socket) {
    let hybridsocket = new HybridSocket(curId++, socket);
    hybridsocket.on('handshake', self.handshake.handle.bind(self.handshake, hybridsocket));
    hybridsocket.on('heartbeat', self.heartbeat.handle.bind(self.heartbeat, hybridsocket));
    hybridsocket.on('disconnect', self.heartbeat.clear.bind(self.heartbeat, hybridsocket.id));
    hybridsocket.on('closing', Kick.handle.bind(null, hybridsocket));
    self.emit('connection', hybridsocket);
  };

  this.connector = app.components.__connector__.connector;
  this.dictionary = app.components.__dictionary__;
  this.protobuf = app.components.__protobuf__;
  this.decodeIO_protobuf = app.components.__decodeIO__protobuf__;

  if(!this.ssl) {
    this.listeningServer = net.createServer();
  } else {
    this.listeningServer = tls.createServer(this.ssl);
  }
  this.switcher = new Switcher(this.listeningServer, self.opts);

  this.switcher.on('connection', function(socket) {
    gensocket(socket);
  });

  if(!!this.distinctHost) {
    this.listeningServer.listen(this.port, this.host);
  } else {
    this.listeningServer.listen(this.port);
  }

  process.nextTick(cb);
};

Connector.prototype.stop = function(force, cb) {
  this.switcher.close();
  this.listeningServer.close();

  process.nextTick(cb);
};

Connector.decode = Connector.prototype.decode = coder.decode;

Connector.encode = Connector.prototype.encode = coder.encode;
