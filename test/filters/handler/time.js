let should = require('should');
let serialFilter = require('../../../lib/filters/handler/time');
let FilterService = require('../../../lib/common/service/filterService');
let util = require('util');
let mockSession = {
  key : "123"
};

let WAIT_TIME = 100;
describe("#serialFilter",function(){
  it("should do before filter ok",function(done){
    let service = new FilterService();
    let filter = serialFilter();
    service.before(filter);


    service.beforeFilter(null,mockSession,function(){
      should.exist(mockSession);

      should.exist(mockSession.__startTime__);
      done();
    });
  });

  it("should do after filter by doing before filter ok",function(done){
    let service = new FilterService();
    let filter = serialFilter();
    let _session ;
    service.before(filter);

    service.beforeFilter(null,mockSession,function(){
      should.exist(mockSession);
      should.exist(mockSession.__startTime__);
      _session = mockSession;
    });

    service.after(filter);

    service.afterFilter(null,{route:"hello"},mockSession,null,function(){
      should.exist(mockSession);
      should.strictEqual(mockSession,_session);
    });

    setTimeout(done,WAIT_TIME);
    done();
  });
});