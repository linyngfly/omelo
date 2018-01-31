let EventEmitter = require('events').EventEmitter;
let Util = require('util');

let mock = require('./mock');

let HaClient = function() {
	EventEmitter.call(this);
	this.init();
}

Util.inherits(HaClient, EventEmitter);

HaClient.prototype.init = function() {
	let self = this;
	setTimeout(function() {
		self.emit('ready');
	}, 1000)
}

HaClient.prototype.getClient = function(node, role) {
	role = role || 'master';

	return mock[node][role];
}

module.exports = HaClient;