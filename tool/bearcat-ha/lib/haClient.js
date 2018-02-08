/*!
 * .______    _______     ___      .______       ______     ___   .__________.
 * (   _  )  (   ____)   /   \     (   _  )     (      )   /   \  (          )
 * |  |_)  ) |  |__     /  ^  \    |  |_)  )   |  ,----'  /  ^  \ `---|  |---`
 * |   _  <  |   __)   /  /_\  \   |      )    |  |      /  /_\  \    |  |
 * |  |_)  ) |  |____ /  _____  \  |  |)  ----.|  `----./  _____  \   |  |
 * (______)  (_______/__/     \__\ ( _| `.____) (______)__/     \__\  |__|
 *
 * Bearcat-ha HaClient
 * Copyright(c) 2015 fantasyni <fantasyni@163.com>
 * MIT Licensed
 */

let logger = require('omelo-logger').getLogger('bearcat-ha', 'HaClient');
let EventEmitter = require('events').EventEmitter;
let zooKeeper = require("node-zookeeper-client");
let HASTATE = require('./util/haClientState');
let Constant = require('./util/constant');
let zkEvent = zooKeeper.Event;
let async = require('async');
let Util = require('util');

// let flag = 0;
// setTimeout(function() {
// 	logger.debug('flag set 1 ...');
// 	flag = 1;
// }, 5000);

let HaClient = function(opts) {
	EventEmitter.call(this);
	this.indexs = {}; // slaves index
	this.haState = {};
	this.zkClient = null;
	this.state = HASTATE.STATE_INIT;
	this.reconnectTimer = null;
	this.chroot = opts.chroot || Constant.ZK_DEFAULT_CHROOT;
	this.servers = opts.servers;
	this.username = opts.username;
	this.password = opts.password;
	this.zkConnectTimeout = opts.zkConnectTimeout || Constant.ZK_DEFAULT_CONNECT_TIMEOUT;
	this.zkPath = opts.zkPath || Constant.ZK_DEFAULT_PATH;
	this.init();
}

Util.inherits(HaClient, EventEmitter);

HaClient.prototype.init = function() {
	let self = this;

	this.initZK(function() {});
}

HaClient.prototype.restart = function() {
	if (this.state == HASTATE.STATE_CONNECTING || this.state == HASTATE.STATE_RECONNECTING) {
		return;
	}

	logger.info('[Restart] internal haState');
	this.zkReconnect();
}

HaClient.prototype.initZK = function(cb) {
	if (this.state >= HASTATE.STATE_CONNECTED) {
		return;
	}

	let self = this;
	let chroot = this.chroot;
	let servers = this.servers;
	let username = this.username;
	let password = this.password;
	let zkConnectTimeout = this.zkConnectTimeout;

	this.state = HASTATE.STATE_CONNECTING;
	let zkClient = zooKeeper.createClient(servers + chroot);
	let timeoutId = setTimeout(function() {
		logger.warn('connect to zookeeper timeout');
		self.state = HASTATE.STATE_TIMEOUT;
		self.emit('timeout');
	}, zkConnectTimeout);

	zkClient.once('connected', function() {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		self.zkClient = zkClient;

		if (username) {
			zkClient.addAuthInfo('digest', new Buffer(username + ':' + password));
		}

		self.getZKChildrenData(function(data) {
			self.onChildrenChange(data, function() {
				self.state = HASTATE.STATE_READY;
				logger.info('connect to ZooKeeper success! data: %j', self.haState);
				self.emit('ready');
			});
		});
	});

	zkClient.on('connected', function() {
		self.state = HASTATE.STATE_CONNECTED;
		self.clearUpTimer();
		logger.info('Connected to the Zookeeper server');
	});

	zkClient.on('disconnected', function() {
		// self.state = HASTATE.STATE_INIT;
		logger.error('Disconnected to zookeeper server');
		self.zkReconnect();
	});

	zkClient.on('expired', function() {
		logger.error('The zooKeeper client session is expired');
	});

	zkClient.on('authenticationFailed', function() {
		logger.error('Authentication to zooKeeper server failed');
	});

	zkClient.connect();
};

HaClient.prototype.zkReconnect = function() {
	let self = this;

	if (self.reconnectTimer) {
		return;
	}

	self.clearUp();
	this.state = HASTATE.STATE_RECONNECTING;
	let s = Math.floor(Math.random(0, 1) * 50);
	let p = Math.floor(Math.random(0, 1) * 100);

	if (!self.reconnectTimer) {
		self.reconnectTimer = setInterval(function() {
			if (self.state < HASTATE.STATE_CONNECTING) {
				logger.info('zookeeper client reconnecting');
				self.initZK(function() {})
			}
		}, 3000 + s * 100 + p);
	}
}

HaClient.prototype.clearUpTimer = function() {
	if (this.reconnectTimer) {
		clearInterval(this.reconnectTimer);
		this.reconnectTimer = null;
	}
}

HaClient.prototype.clearUp = function() {
	this.haState = {};
	this.indexs = {};
	if (this.zkClient) {
		this.zkClient.close();
	}
	this.zkClient = null;
	this.state = HASTATE.STATE_INIT;
}

HaClient.prototype.onChildrenChange = function(data, callback) {
	let self = this;
	callback = callback || function() {};

	async.each(Object.keys(data), function(path, next) {
		self.setState(path, data[path]);
		next();
	}, callback);
};

HaClient.prototype.getZKChildrenData = function(callback) {
	let self = this;
	self.zkClient.getChildren(self.zkPath, function(event) {
		if (event.type == zkEvent.NODE_CHILDREN_CHANGED) {
			self.getZKChildrenData(function(data) {
				self.onChildrenChange(data);
			});
		}
	}, function(err, children) {
		let result = {};
		if (err) {
			logger.error('get ZooKeeper children error: %s', err.stack);
			return callback(result);
		}

		async.each(children, function(path, next) {
			self.getZKData(path, function(data) {
				result[path] = data;
				next();
			});
		}, function() {
			callback(result);
		});
	});
};

HaClient.prototype.getZKData = function(path, callback) {
	let fullPath = this.zkPath + '/' + path;
	this.zkClient.getData(fullPath, function(err, data) {
		if (err) {
			logger.error('get ZooKeeper path %s data error: %s', fullPath, err.stack);
			return callback(data);
		}

		if (data) {
			data = data.toString();
			try {
				data = JSON.parse(data);
			} catch (e) {
				logger.error('JSON parse ZooKeeper path: %s data: %s error: ', fullPath, data, e.stack);
				data = null;
			}
		} else {
			logger.error('zookeeper path %s data is null !', fullPath);
		}

		logger.debug('getZKData %j', data);
		callback(data);
	});
};

HaClient.prototype.watchZkData = function(path) {
	let self = this;

	self.zkClient.getData(self.zkPath + '/' + path, function(event) {
		if (event.type == zkEvent.NODE_DATA_CHANGED) {
			logger.info('watchZkData %s NODE_CHILDREN_CHANGED', path);
			self.getZKData(path, function(data) {
				self.onDataChange(path, data);
			});
		}

		if (event.type === zkEvent.NODE_DELETED) {
			logger.warn('watchZkData %s NODE_DELETED', path);
			self.removeState(path);
		} else {
			self.watchZkData(path);
		}

	}, function(err) {
		if (err) {
			logger.error('watch zookeeper data, path: %s, error: %s', self.zkPath + '/' + path, err.stack);
		}
	});
};

// zookeeper data change
HaClient.prototype.onDataChange = function(path, state) {
	if (!state) return;

	// if (flag) {
	// 	return;
	// }

	let oldState = this.haState[path];
	this.setState(path, state);

	if (!oldState) {
		this.emit('nodeAdd', path, state);
		return;
	}

	this.emit('change', path, state);

	if (oldState.master != state.master) {
		this.emit('masterChange', path, state);
	}
};

HaClient.prototype.setState = function(name, state) {
	if (!this.haState[name]) {
		this.watchZkData(name);
	}

	if (!state) {
		return;
	}

	this.haState[name] = state;
};

HaClient.prototype.removeState = function(name) {
	let state = this.haState[name];
	if (!state) return;

	this.emit('nodeRemove', name, state);

	delete this.haState[name];
};

HaClient.prototype.checkValid = function(nodeName, clientName) {
	let state = this.haState[nodeName];

	if (!state) {
		return false;
	}

	if (state.master == clientName) {
		return true;
	}

	let slaves = state.slaves;
	for (let i = 0; i < slaves.length; i++) {
		if (slaves[i] == clientName) {
			return true;
		}
	}

	let unavailable = state.unavailable;
	for (let j = 0; j < unavailable.length; j++) {
		if (unavailable[j] == clientName) {
			return true;
		}
	}

	return false;
}

//get client node
HaClient.prototype.getClient = function(name, role) {
	if (this.state < HASTATE.STATE_READY) {
		return;
	}

	let state = this.haState[name];

	if (!state) {
		logger.error('getClient error %s %s %j \n %s', name, role, this.haState, new Error('').stack);
		this.zkReconnect();
		return;
	}

	let clientNode = null;

	if (role === 'slave') {
		let index = this.indexs[name] || 0;
		if (index >= state.slaves.length) {
			index = 0;
		}

		clientNode = state.slaves[index++];
		this.indexs[name] = index;
	} else {
		clientNode = state.master;
	}

	if (!clientNode) {
		logger.error('redisFailover clientNode null error %s %s %j \n %s', name, role, this.haState, new Error('').stack);
		this.zkReconnect();
	}

	return clientNode;
};

module.exports = HaClient;