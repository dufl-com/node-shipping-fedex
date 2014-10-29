var fedexAPI = require('../lib/index');
var util = require('util');

var fedex = new fedexAPI({
  environment: 'sandbox', // or live
  key: 'FEDEXKEY',
  password: 'FEDEXPASSWORD',
  account_number: 'FEDEXACCOUNTNUMBER',
  meter_number: 'FEDEXMETERNUMBER',
  imperial: true // set to false for metric
});

// Testing submodule change 2