  let Emitter = require('emitter');
  window.EventEmitter = Emitter;

  let protocol = require('pomelo-protocol');
  window.Protocol = protocol;
  
  let protobuf = require('pomelo-protobuf');
  window.protobuf = protobuf;
  
  let pomelo = require('pomelo-jsclient-websocket');
  window.pomelo = pomelo;
