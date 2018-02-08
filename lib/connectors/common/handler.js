let protocol = require('omelo-protocol');
let Package = protocol.Package;
let logger = require('omelo-logger').getLogger('pomelo', __filename);

let handlers = {};

let ST_INITED = 0;
let ST_WAIT_ACK = 1;
let ST_WORKING = 2;
let ST_CLOSED = 3;

let handleHandshake = function(socket, pkg) {
  if(socket.state !== ST_INITED) {
    return;
  }
  try {
    socket.emit('handshake', JSON.parse(protocol.strdecode(pkg.body)));
  } catch (ex) {
    socket.emit('handshake', {});
  }
};

let handleHandshakeAck = function(socket, pkg) {
  if(socket.state !== ST_WAIT_ACK) {
    return;
  }
  socket.state = ST_WORKING;
  socket.emit('heartbeat');
};

let handleHeartbeat = function(socket, pkg) {
  if(socket.state !== ST_WORKING) {
    return;
  }
  socket.emit('heartbeat');
};

let handleData = function(socket, pkg) {
  if(socket.state !== ST_WORKING) {
    return;
  }
  socket.emit('message', pkg);
};

handlers[Package.TYPE_HANDSHAKE] = handleHandshake;
handlers[Package.TYPE_HANDSHAKE_ACK] = handleHandshakeAck;
handlers[Package.TYPE_HEARTBEAT] = handleHeartbeat;
handlers[Package.TYPE_DATA] = handleData;

let handle = function(socket, pkg) {
  let handler = handlers[pkg.type];
  if(!!handler) {
    handler(socket, pkg);
  } else {
    logger.error('could not find handle invalid data package.');
    socket.disconnect();
  }
};

module.exports = handle;
