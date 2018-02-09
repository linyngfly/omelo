let omelo = require('../');
let should = require('should');
let mockBase = process.cwd() + '/test';

describe('omelo', function() {
  describe('#createApp', function() {
    it('should create and get app, be the same instance', function(done) {
      let app = omelo.createApp({base: mockBase});
      should.exist(app);

      let app2 = omelo.app;
      should.exist(app2);
      should.strictEqual(app, app2);
      done();
    });
  });
});
