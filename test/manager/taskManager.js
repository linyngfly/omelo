let should = require('should');
let taskManager = require('../../lib/common/manager/taskManager');

// set timeout for test
taskManager.timeout = 100;

let WAIT_TIME = 200;

describe("#taskManager",function(){
  it("should add task and execute it",function(done){
    let key = 'key-1';
    let fn = function(task) {
      taskCount++;
      task.done();
    };
    let onTimeout = function() {
      should.fail('should not timeout.');
    };
    let taskCount = 0;

    taskManager.addTask(key, fn, onTimeout);

    setTimeout(function() {
      taskCount.should.equal(1);
      done();
    }, WAIT_TIME);
  });

  it("should fire timeout callback if task timeout",function(done){
    let key = 'key-1';
    let fn = function(task) {
      taskCount++;
    };
    let onTimeout = function() {
      timeoutCount++;
    };
    let taskCount = 0;
    let timeoutCount = 0;

    taskManager.addTask(key, fn, onTimeout);

    setTimeout(function() {
      taskCount.should.equal(1);
      timeoutCount.should.equal(1);
      done();
    }, WAIT_TIME);
  });

  it("should not fire timeout after close the task",function(done){
    let key = 'key-1';
    let fn = function(task) {
      taskCount++;
    };
    let onTimeout = function() {
      timeoutCount++;
    };
    let taskCount = 0;
    let timeoutCount = 0;

    taskManager.addTask(key, fn, onTimeout);

    process.nextTick(function() {
      taskManager.closeQueue(key, true);

      setTimeout(function() {
        taskCount.should.equal(1);
        timeoutCount.should.equal(0);
        done();
      }, WAIT_TIME);
    });
  });

  it("should be ok to remove a queue not exist",function(){
    let key = 'key-n';
    taskManager.closeQueue(key, true);
  });
});
