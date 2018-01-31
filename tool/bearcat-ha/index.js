let HaClient = require('./lib/haClient');

let bearcatHa = {};

bearcatHa.createClient = function(opts) {
	return new HaClient(opts);
}

bearcatHa.HASTATE = require('./lib/util/haClientState');

module.exports = bearcatHa;