let should = require('should');
let timeoutFilter = require('../../../lib/filters/handler/timeout');
let FilterService = require('../../../lib/common/service/filterService');
let util = require('util');
let mockSession = {
  key : "123"
};

let WAIT_TIME = 100;
describe("#serialFilter",function(){
  it("should do before filter ok",function(done){
    let service = new FilterService();
    let filter = timeoutFilter();
    service.before(filter);

    service.beforeFilter(null,mockSession,function(){
      should.exist(mockSession);

      should.exist(mockSession.__timeout__);
      done();
    });
  });

  it("should do after filter by doing before filter ok",function(done){
    let service = new FilterService();
    let filter = timeoutFilter();
    let _session ;
    service.before(filter);

    service.beforeFilter(null,mockSession,function(){
      should.exist(mockSession);
      should.exist(mockSession.__timeout__);
      _session = mockSession;
    });

    service.after(filter);

    service.afterFilter(null,null,mockSession,null,function(){
      should.exist(mockSession);
      should.strictEqual(mockSession,_session);
    });

    setTimeout(done,WAIT_TIME);
    done();
  });
});