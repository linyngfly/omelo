let should = require('should');
let FilterService = require('../../lib/common/service/filterService');

let WAIT_TIME = 50;

let mockFilter1 = {
  before: function(msg, session, cb) {
    session.beforeCount1++;
    cb();
  },

  after: function(err, msg, session, resp, cb) {
    session.afterCount1++;
    cb();
  }
};

let mockFilter2 = {
  before: function(msg, session, cb) {
    session.beforeCount2++;
    cb();
  },

  after: function(err, msg, session, resp, cb) {
    session.afterCount2++;
    cb();
  }
};

let blackholdFilter = {
  before: function() {},
  after: function() {}
};

let MockSession = function(){
  this.beforeCount1 = 0;
  this.afterCount1 = 0;
  this.beforeCount2 = 0;
  this.afterCount2 = 0;
};

describe('filter service test', function() {
  describe('#filter', function() {
    it('should register before filter by calling before method and fire filter chain by calling beforeFilter', function(done) {
      let session = new MockSession();
      let service = new FilterService();
      service.before(mockFilter1);
      service.before(mockFilter2);
      service.beforeFilter(null, session, function() {
        should.exist(session);
        session.beforeCount1.should.equal(1);
        session.beforeCount2.should.equal(1);
        session.afterCount1.should.equal(0);
        session.afterCount2.should.equal(0);
        done();
      });
    });

    it('should register after filter by calling after method and fire filter chain by calling afterFilter', function(done) {
      let session = new MockSession();
      let service = new FilterService();
      service.after(mockFilter1);
      service.after(mockFilter2);
      service.afterFilter(null, null, session, null, function() {
        should.exist(session);
        session.beforeCount1.should.equal(0);
        session.beforeCount2.should.equal(0);
        session.afterCount1.should.equal(1);
        session.afterCount2.should.equal(1);
        done();
      });
    });

    it('should be ok if filter is a function', function(done) {
      let session = {beforeCount: 0, afterCount: 0};
      let service = new FilterService();
      let beforeCount = 0, afterCount = 0;

      service.before(function(msg, session, cb) {
        session.beforeCount++;
        cb();
      });
      service.after(function(err, msg, session, resp, cb) {
        session.afterCount++;
        cb();
      });
      service.beforeFilter(null, session, function() {
        beforeCount++;
      });
      service.afterFilter(null, null, session, null, function() {
        afterCount++;
      });

      setTimeout(function() {
        session.beforeCount.should.equal(1);
        session.afterCount.should.equal(1);
        beforeCount.should.equal(1);
        afterCount.should.equal(1);

        done();
      }, WAIT_TIME);
    });

    it('should not invoke the callback if filter not invoke callback', function(done) {
      let session = new MockSession();
      let service = new FilterService();
      let beforeCount = 0, afterCount = 0;

      service.before(blackholdFilter);
      service.after(blackholdFilter);
      service.beforeFilter(null, session, function() {
        beforeCount++;
      });
      service.afterFilter(null, null, session, null, function() {
        afterCount++;
      });

      setTimeout(function() {
        session.beforeCount1.should.equal(0);
        session.beforeCount2.should.equal(0);
        session.afterCount1.should.equal(0);
        session.afterCount2.should.equal(0);
        beforeCount.should.equal(0);
        afterCount.should.equal(0);

        done();
      }, WAIT_TIME);
    });

    it('should pass the err and resp parameters to callback and ignore the filters behind if them specified in before filter', function(done) {
      let session = new MockSession();
      let service = new FilterService();
      let error = 'some error message';
      let response = {key: 'some value'};
      let respFilter = {
        before: function(msg, session, cb) {
          cb(error, response);
        }
      };

      service.before(mockFilter1);
      service.before(respFilter);
      service.before(mockFilter2);
      service.beforeFilter(null, session, function(err, resp) {
        should.exist(err);
        err.should.equal(error);
        should.exist(resp);
        resp.should.equal(response);

        session.beforeCount1.should.equal(1);
        session.beforeCount2.should.equal(0);
        session.afterCount1.should.equal(0);
        session.afterCount2.should.equal(0);

        done();
      });
    });
  });
});