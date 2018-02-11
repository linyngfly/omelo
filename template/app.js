const omelo = require('omelo');
const path = require('path');
const omeloHttpPlugin = require('omelo-http-plugin');

/**
 * Init app for client.
 */
let app = omelo.createApp();
app.set('name', '$');

// app configuration
app.configure('production|development', 'connector', function () {
  app.set('connectorConfig', {
    connector: omelo.connectors.hybridconnector,
    heartbeat: 3,
    useDict: true,
    useProtobuf: true
  });
});

app.configure('production|development', 'http', function () {
  app.loadConfig('http', path.join(app.getBase(), 'config/http.json'));
  app.use(omeloHttpPlugin, {
    http: app.get('http')
  });

  app.beforeStopHook(function () {
    //todo add user code
  });

});

// start app
app.start();

process.on('uncaughtException', function (err) {
  console.error(' Caught exception: ' + err.stack);
});