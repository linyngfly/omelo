let EventEmitter = require('events').EventEmitter;
let util = require('util');
let utils = require('../../util/utils');
let TcpSocket = require('./tcpsocket');

let ST_STARTED = 1;
let ST_CLOSED = 2;

// private protocol, no need exports
let HEAD_SIZE = 4;

/**
 * websocket protocol processor
 */
let Processor = function(closeMethod) {
  EventEmitter.call(this);
  this.closeMethod = closeMethod;
  this.state = ST_STARTED;
};
util.inherits(Processor, EventEmitter);

module.exports = Processor;

Processor.prototype.add = function(socket, data) {
  if(this.state !== ST_STARTED) {
    return;
  }
  let tcpsocket = new TcpSocket(socket, {headSize: HEAD_SIZE,
                                         headHandler: utils.headHandler,
                                         closeMethod: this.closeMethod});
  this.emit('connection', tcpsocket);
  socket.emit('data', data);
};

Processor.prototype.close = function() {
  if(this.state !== ST_STARTED) {
    return;
  }
  this.state = ST_CLOSED;
};