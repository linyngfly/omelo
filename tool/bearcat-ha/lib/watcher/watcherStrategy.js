/*!
 * .______    _______     ___      .______       ______     ___   .__________.
 * (   _  )  (   ____)   /   \     (   _  )     (      )   /   \  (          )
 * |  |_)  ) |  |__     /  ^  \    |  |_)  )   |  ,----'  /  ^  \ `---|  |---`
 * |   _  <  |   __)   /  /_\  \   |      )    |  |      /  /_\  \    |  |
 * |  |_)  ) |  |____ /  _____  \  |  |)  ----.|  `----./  _____  \   |  |
 * (______)  (_______/__/     \__\ ( _| `.____) (______)__/     \__\  |__|
 *
 * Bearcat-ha WatcherStrategy
 * Copyright(c) 2015 fantasyni <fantasyni@163.com>
 * MIT Licensed
 */

let logger = require('omelo-logger').getLogger('bearcat-ha', 'WatcherStrategy');
let Utils = require('../util/utils');
let WatcherStrategy = {};

WatcherStrategy.elect = function(data) {
  let votes = {};

  data.forEach(function(item) {
    item.available.forEach(function(i) {
      if (!Utils.isNotNull(votes[i])) {
        votes[i] = 0;
      }

      votes[i] += 1;
    });

    item.unavailable.forEach(function(i) {
      if (!Utils.isNotNull(votes[i])) {
        votes[i] = 0;
      }

      votes[i] -= 1;
    });
  });

  let available = [];
  let unavailable = [];

  for (let name in votes) {
    if (votes[name] > 0) {
      available.push(name);
    } else {
      unavailable.push(name);
    }
  }

  if (unavailable.length) {
    // logger.error('elect votes %j', votes);
  }

  return {
    available: available,
    unavailable: unavailable
  };
};

/**
 *
 * @param node {string}
 * @param snapshots {array}
 * @returns {boolean} return true means the node is available if a majority of watchers say this node is available
 */
WatcherStrategy.electNode = function(node, snapshots) {
  let count = 0;
  snapshots.forEach(function(snapshot) {
    if (snapshot.unavailable.indexOf(node) > -1) {
      count -= 1;
    } else {
      count += 1;
    }
  });

  return count > 0;
};


WatcherStrategy.consensus = function() {

};

module.exports = WatcherStrategy;