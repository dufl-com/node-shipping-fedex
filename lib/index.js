/*

 Built by
   __                   ____
  / /___  ______  ___  / __/___  ____
 / __/ / / / __ \/ _ \/ /_/ __ \/ __ \
/ /_/ /_/ / /_/ /  __/ __/ /_/ / /_/ /
\__/\__, / .___/\___/_/  \____/\____/
 /____/_/
 */

var https = require('https');
var extend = require('extend');
var builder = require('xmlbuilder');
var parser = require('xml2json');

function FedEX(args) {
  var hosts = {
      sandbox: 'wwwcie.ups.com',
      live: 'onlinetools.ups.com'
    },
    defaults = {
      imperial: true, // for inches/lbs, false for metric cm/kgs
      currency: 'USD',
      language: 'en-US',
      environment: 'sandbox',
      key: '',
      password: '',
      account_number: '',
      meter_number: '',
      pretty: false,
      user_agent: 'uh-sem-blee, Co | typefoo'
    };

  var resources = {
 
  };

  function buildResourceFunction(i, resources) {
    return function(data, options, callback) {
      if(!callback) {
        callback = options;
        options = undefined;
      }
      var authorize = $scope.buildAccessRequest(data, options);
      var callBody = resources[i].f(data, options);
      var body = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n' + authorize + callBody;
      console.log(body);
      var req = https.request({
        host: hosts[$scope.options.environment],
        path: resources[i].p,
        method: 'POST',
        headers: {
          'Content-Length': body.length,
          'Content-Type': 'text/xml'
        }
      });

      req.write(body);
      req.on('error', function(e) {
        return callback(e, null);
      });
      req.on('response', function(res) {
        var responseData = '';

        res.on('data', function(data) {
          data = data.toString();
          responseData += data;
        });

        res.on('end', function() {
          try {
            var jsonString = parser.toJson(responseData);
            var json = JSON.parse(jsonString);
          } catch(e) {
            return callback('Invalid JSON', null);
          }

          return resources[i].r(json, callback);
        });
      });
      req.end();
    }
  }

  for(var i in resources) {
    $scope[i] = buildResourceFunction(i, resources);
  }

  return $scope.config(args);
}

module.exports = FedEx;