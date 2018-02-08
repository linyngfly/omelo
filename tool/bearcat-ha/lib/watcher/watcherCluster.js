/*!
 * .______    _______     ___      .______       ______     ___   .__________.
 * (   _  )  (   ____)   /   \     (   _  )     (      )   /   \  (          )
 * |  |_)  ) |  |__     /  ^  \    |  |_)  )   |  ,----'  /  ^  \ `---|  |---`
 * |   _  <  |   __)   /  /_\  \   |      )    |  |      /  /_\  \    |  |
 * |  |_)  ) |  |____ /  _____  \  |  |)  ----.|  `----./  _____  \   |  |
 * (______)  (_______/__/     \__\ ( _| `.____) (______)__/     \__\  |__|
 *
 * Bearcat-ha WatcherCluster
 * Copyright(c) 2015 fantasyni <fantasyni@163.com>
 * MIT Licensed
 */

let logger = require('omelo-logger').getLogger('bearcat-ha', 'WatcherCluster');
let ZookeeperClient = require('../client/zookeeperClient');
let WatcherManager = require('./watcherManager');
let async = require('async');

let watcherManagers = {};
let START_WATCHER_DELAY = -1;

let WatcherCluster = {};

//set up
WatcherCluster.setup = function(config) {
  this.init(config);

  ZookeeperClient.createClient(config.zooKeeper, function() {
    async.eachSeries(config.nodes, function(node, next) {
      node.zooKeeper = config.zooKeeper;
      node.type = config.type;

      let name = node.name;
      if (!name || watcherManagers[name]) {
        throw new Error('node name must be unequal!');
      }

      watcherManagers[name] = new WatcherManager(node);

      if (START_WATCHER_DELAY !== -1) {
        setTimeout(next, START_WATCHER_DELAY);
      } else {
        next();
      }
    }, function() {
      logger.info('WatcherCluster started ...');
    });
  });
};

// reset node after the config was changed
WatcherCluster.reset = function(config) {
  this.init(config);

  ZookeeperClient.createClient(config.zooKeeper, function() {
    async.eachSeries(config.nodes, function(node, next) {
      let watcher = watcherManagers[node.name];
      node.zooKeeper = config.zooKeeper;
      node.type = config.type;

      if (!watcher) {
        logger.info('add new watcher: %s', node.name);
        watcherManagers[node.name] = new WatcherManager(node);
      } else {
        watcher.resetWatcherNodes(node);
      }

      if (START_WATCHER_DELAY !== -1) {
        setTimeout(next, START_WATCHER_DELAY);
      } else {
        next();
      }
    }, function() {
      logger.info('WatcherCluster reset configuration complete ...');
    });
  });
};

WatcherCluster.init = function(config) {
  if (config['startWatcherDelay']) {
    START_WATCHER_DELAY = config['startWatcherDelay'];
  }
}

module.exports = WatcherCluster;