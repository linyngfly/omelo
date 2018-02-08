  let Emitter = require('emitter');
  window.EventEmitter = Emitter;

  let protocol = require('omelo-protocol');
  window.Protocol = protocol;
  
  let protobuf = require('omelo-protobuf');
  window.protobuf = protobuf;
  
  let pomelo = require('pomelo-jsclient-websocket');
  window.pomelo = pomelo;
