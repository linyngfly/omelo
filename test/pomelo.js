let pomelo = require('../');
let should = require('should');
let mockBase = process.cwd() + '/test';

describe('pomelo', function() {
  describe('#createApp', function() {
    it('should create and get app, be the same instance', function(done) {
      let app = pomelo.createApp({base: mockBase});
      should.exist(app);

      let app2 = pomelo.app;
      should.exist(app2);
      should.strictEqual(app, app2);
      done();
    });
  });
});
