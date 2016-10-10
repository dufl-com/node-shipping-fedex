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
var moment = require('moment');

function FedEx(args) {
    var $scope = this,
    hosts = {
        sandbox: 'wsbeta.fedex.com',
        live: 'ws.fedex.com'
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
        user_agent: 'uh-sem-blee, Co | typefoo',
        debug: false
    },
    default_services = {

    };

    $scope.options = defaults;

    function doBuildParams(data, options, resource) {
        //var authorize = $scope.buildAccessRequest(data, options);
        //var callBody = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + authorize + '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + resource.f(data, options);
        var callBody = resource.f(data, options);
        var body = callBody;
        var params = {
            host: hosts[$scope.options.environment],
            path: resource.p,
            method: 'POST',
            headers: {
                'Content-Length': body.length,
                'Content-Type': 'text/xml',
                'User-Agent': $scope.options.user_agent
            }
        };

        return {
            body: body,
            params: params
        };
    }

    function doRequest(params, body, callback) {
        if (!callback) {
            callback = body;
            body = null;
        }

        if ($scope.options.debug) {
            //var json = parser.toJson(body); //returns a string containing the JSON structure by
            //console.log(JSON.stringify(json, undefined, 2));
            //console.log('Request: ');
            //console.log(params);
        }

        var req = https.request(params);

        req.write(body);
        req.on('error', function(e) {
            return callback(e, null);
        });
        req.on('response', function(res) {
            var responseData = '';

            res.on('data', function(data) {
                responseData += data.toString();
            });

            res.on('end', function() {
                try {
                    var jsonString = parser.toJson(responseData);
                    var json = JSON.parse(jsonString);
                } catch (e) {
                    return callback('Invalid JSON', null);
                }

                return callback(null, json);
            });
        });
        req.end();
    }


    function buildAddress(data) {
        var address = {
            "StreetLines": data.address_line_1 + " " + data.address_line_2 || '',
            "City": data.city || '',
            "StateOrProvinceCode": data.state_code || '',
            "PostalCode": data.postal_code || '',
            "CountryCode": data.country_code || ''
        };

        return address;
    }

    function buildShipmentAttributes(data) {
        var attributes = {
            'Dimensions': {
                'Length': data.dimensions.length,
                'Width': data.dimensions.width,
                'Height': data.dimensions.height,
                'Units': "IN"
            },
            'Weight': {
                'Units': "LB",
                'Value': data.weight
            }
        }
        return attributes;
    }

    function buildPaymentInformation(data, options) {
        var payment = {
            "PaymentType": "SENDER",
            "Payor": {
                "ResponsibleParty": {
                    "AccountNumber": data.shipper.shipper_number || '',
                    "Contact": {
                        "ContactId": data.shipper.company_name || '',
                        "PersonName": data.shipper.company_name || '',
                    }
                }
            }
        };

        return payment;
    }

    function buildLabelSpecification(data, options) {
        var label = {
            "LabelFormatType": "COMMON2D",
            "ImageType": "PNG",
            "LabelStockType": "PAPER_4X6"
        };

        return label;
    }



    function buildShipmentRate(data) {
        data.shipper = data.shipper || {address: {}};
        data.ship_to = data.ship_to || {address: {}};
        data.packages = data.packages || [
            {}
        ];
        data.currency = data.currency || $scope.options.currency;

        var shipment = {
            "ShipTimestamp": data.pickup_timestamp, //"2014-10-14T09:30:47-07:00",
            "DropoffType": data.pickup_type ? data.pickup_type : 'REGULAR_PICKUP',
            "PackagingType": "YOUR_PACKAGING",
            "Shipper": {
                "Contact": {
                    "PersonName": data.ship_from.name || (data.ship_from.company_name || ''),
                    "PhoneNumber": data.ship_from.phone_number || ''
                },
                "Address": buildAddress(data.ship_from.address)
            },
            "Recipient": {
                "Contact": {
                    "PersonName": data.ship_to.name || (data.ship_to.company_name || ''),
                    "PhoneNumber": data.ship_to.phone_number || ''
                },
                "Address": buildAddress(data.ship_to.address)
            },
            "RateRequestTypes": "LIST",
            "PackageDetail": "INDIVIDUAL_PACKAGES"
        };

        shipment['RequestedPackageLineItems'] = [];

        var packageCount = 0;

        for (var i = 0; i < data.packages.length; i++) {
            var p = {
                "SequenceNumber" : i + 1,
                'Weight': {
                    'Units': $scope.options.imperial ? 'LB' : 'KG',
                    'Value': data.packages[i].weight || ''
                }
            };

         /*   if (data.packages[i].description) {
                p['Package']['Description'] = data.packages[i].description;
            }*/

            if (data.packages[i].dimensions) {
                p['Dimensions'] = {
                    'Length': data.packages[i].dimensions.length || '1',
                    'Width': data.packages[i].dimensions.width || '1',
                    'Height': data.packages[i].dimensions.height || '1',
                    'Units': $scope.options.imperial ? 'IN' : 'CM'
                };
            }

            shipment['RequestedPackageLineItems'].push(p);
            packageCount++;
        };
        //shipment['PackageCount'] = packageCount;

        return shipment;
    }

    function buildShipment(data) {
        data.shipper = data.shipper || {address: {}};
        data.ship_to = data.ship_to || {address: {}};
        data.packages = data.packages || [
            {}
        ];
        data.currency = data.currency || $scope.options.currency;

        var shipment = {
            "ShipTimestamp": data.pickup_timestamp, //"2014-10-14T09:30:47-07:00",
            "DropoffType": data.pickup_type ? data.pickup_type : 'REGULAR_PICKUP',
            "ServiceType": data.services[0],
            "PackagingType": "YOUR_PACKAGING",
            "Shipper": {
                "Contact": {
                    "PersonName": data.ship_from.name || (data.ship_from.company_name || ''),
                    "PhoneNumber": data.ship_from.phone_number || ''
                },
                "Address": buildAddress(data.ship_from.address)
            },
            "Recipient": {
                "Contact": {
                    "PersonName": data.ship_to.name || (data.ship_to.company_name || ''),
                    "PhoneNumber": data.ship_to.phone_number || ''
                },
                "Address": buildAddress(data.ship_to.address)
            },
            "ShippingChargesPayment": buildPaymentInformation(data),
            "LabelSpecification": buildLabelSpecification(data),
            "RateRequestTypes": "LIST",
            "PackageCount": "1"
        };

        shipment['RequestedPackageLineItems'] = [];

        var packageCount = 0;

        for (var i = 0; i < data.packages.length; i++) {
            var p = {
                "SequenceNumber" : i + 1,
                'Weight': {
                    'Units': $scope.options.imperial ? 'LB' : 'KG',
                    'Value': data.packages[i].weight || ''
                }
            };

            /*   if (data.packages[i].description) {
             p['Package']['Description'] = data.packages[i].description;
             }*/

            if (data.packages[i].dimensions) {
                p['Dimensions'] = {
                    'Length': data.packages[i].dimensions.length || '1',
                    'Width': data.packages[i].dimensions.width || '1',
                    'Height': data.packages[i].dimensions.height || '1',
                    'Units': $scope.options.imperial ? 'IN' : 'CM'
                };
            }

            shipment['RequestedPackageLineItems'].push(p);
            packageCount++;
        }
        ;

        //shipment['ShippingChargesPayment'] = buildPaymentInformation(data);
        return shipment;
    }

    function buildOriginDetail(data) {
        try{
        var originDetail = {
            "PickupLocation": {
                "Contact": {
                    "ContactId": "",
                    "PersonName": data.ship_from.name,
                    "Title": "",
                    "CompanyName": data.ship_from.company_name,
                    "PhoneNumber": data.ship_from.phone_number,
                    "EMailAddress": "",
                },
                "Address": buildAddress(data.ship_from.address)
            },
            //"PackageLocation": "", //FRONT SIDE REAR
            //"BuildingPartCode": "",
            "BuildingPartDescription": "",
            "ReadyTimestamp": data.pickup_timestamp,
            "CompanyCloseTime": moment(data.pickup_timestamp).add('hours', 2).format("HH:MM:SS"),
            //"Location": ""

        }}
        catch(e) {
            console.log(e);
        }

        return originDetail;
    }

    $scope.config = function(args) {
        $scope.options = extend(defaults, args);
        return $scope;
    };

    $scope.buildWebAuth = function(root, options) {
        var webAuthDetailElement = root.ele('WebAuthenticationDetail');
        var webAuthDetailBody = {
            'UserCredential': {
                'Key': $scope.options.key,
                'Password': $scope.options.password
            }
        };
        webAuthDetailElement.ele(webAuthDetailBody);
    };

    $scope.buildClientDetail = function(root, options) {
        var clientDetailElement = root.ele('ClientDetail');
        var clientDetailBody = {
            'AccountNumber': $scope.options.account_number,
            'MeterNumber': $scope.options.meter_number
        };
        clientDetailElement.ele(clientDetailBody);

    }

    $scope.buildAccessRequest = function(data, options) {
        var webAuthDetailRoot = builder.create('WebAuthenticationDetail', {headless: true});
        var webAuthDetailBody = {
            'UserCredential': {
                'Key': $scope.options.key,
                'Password': $scope.options.password
            }
        };
        webAuthDetailRoot.ele(webAuthDetailBody);
        var webAuthDetail = webAuthDetailRoot.end({pretty: $scope.options.pretty});

        var clientDetailRoot = builder.create('ClientDetail', {headless: true});
        var clientDetailBody = {
            'AccountNumber': $scope.options.account_number,
            'MeterNumber': $scope.options.meter_number
        };
        clientDetailRoot.ele(clientDetailBody);
        var clientDetail = clientDetailRoot.end({pretty: $scope.options.pretty});

        return webAuthDetail + clientDetail;
    };

    $scope.buildTrackingRequest = function(tracking_number, options) {
        if (!options) {
            options = {};
        }
        var root = builder.create('TrackRequest', {headless: true});
        root.att('xmlns', 'http://fedex.com/ws/track/v3');
        $scope.buildWebAuth(root);
        $scope.buildClientDetail(root);

        var request = {
            'Version': {
                'ServiceId': 'trck',
                'Major': '3',
                'Intermediate': '0',
                'Minor': '0'
            },
            'PackageIdentifier': {
                'Value': tracking_number,
                'Type': 'TRACKING_NUMBER_OR_DOORTAG'
            },
            'IncludeDetailedScans': '1'
        };

        if (options && options.extra_params && typeof options.extra_params === 'object') {
            request = extend(request, options.extra_params);
        }

        root.ele(request);
        return root.end({pretty: $scope.options.pretty});
    };

    $scope.handleTrackingResponse = function(json, callback) {
        if (json.TrackReply.HighestSeverity !== "SUCCESS") {
            return callback(json.TrackReply.Notifications, null);
        }
        return callback(null, json.TrackReply);
    };

    $scope.buildRateRequest = function(data, options) {
        if (!options) {
            options = {};
        }
        var root = builder.create('RateRequest', {headless: true});

        root.att('xmlns', 'http://fedex.com/ws/rate/v8');
        $scope.buildWebAuth(root);
        $scope.buildClientDetail(root);

        var request = {
            "Version": {
                "ServiceId": "crs",
                "Major": "8",
                "Intermediate": "0",
                "Minor": "0"
            },
            "ReturnTransitAndCommit": "true",
            "RequestedShipment": buildShipmentRate(data)
        }

        if (options && options.extra_params && typeof options.extra_params === 'object') {
            request = extend(request, options.extra_params);
        }

        root.ele(request);
        var xml = root.end({pretty: $scope.options.pretty});
        //console.log(xml);
        return xml;
    }

    $scope.handleRateResponse = function(json, callback) {
        if (json['SOAP-ENV:Fault']) {
            return callback(json['SOAP-ENV:Fault'].faultstring, null);
        }
        return callback(null, json[0].RateReply);
    };

    $scope.buildProcessShipmentRequest = function(data, options) {
        if (!options) {
            options = {};
        }
        var root = builder.create('ProcessShipmentRequest', {headless: true});

        root.att('xmlns', 'http://fedex.com/ws/ship/v13');
        $scope.buildWebAuth(root);
        $scope.buildClientDetail(root);

        var request = {
            "Version": {
                "ServiceId": "ship",
                "Major": "13",
                "Intermediate": "0",
                "Minor": "0"
            },
            "RequestedShipment": buildShipment(data)
        }

        if (options && options.extra_params && typeof options.extra_params === 'object') {
            request = extend(request, options.extra_params);
        }

        root.ele(request);
        var xml = root.end({pretty: $scope.options.pretty});
        //console.log(xml);
        return xml;
    }

    $scope.handleProcessShipmentResponse = function(json, callback) {
        console.log("Fedex Response:: " + JSON.stringify(json));
        if (json['v13:ProcessShipmentReply']) {
            if (json['v13:ProcessShipmentReply']['v13:HighestSeverity'] == "ERROR") {
                console.log("Fedex ProcessShipmentResponse Error:: " + JSON.stringify(json));
                return callback(json, null);
            }
        } else {
            return callback("Error parsing fedex")
        }
        return callback(null, json);
    };

    $scope.buildPickupAvailabilityRequest = function(data, options) {
        if (!options) {
            options = {};
        }
        var root = builder.create('PickupAvailabilityRequest', {headless: true});

        root.att('xmlns', 'http://fedex.com/ws/pickup/v9');
        $scope.buildWebAuth(root);
        $scope.buildClientDetail(root);

        var request = {
            "Version": {
                "ServiceId": "disp",
                "Major": "9",
                "Intermediate": "0",
                "Minor": "0"
            },
            "PickupAddress": buildAddress(data.ship_from.address),
            "PickupRequestType": 'SAME_DAY',
            "DispatchDate": moment(data.pickup_timestamp).format("YYYY-MM-DD"),
            "CustomerCloseTime": "17:00:00", //moment(data.pickup_timestamp).format("HH:mm:ss"),
            "Carriers": 'FDXE',
            "ShipmentAttributes": buildShipmentAttributes(data.packages[0])
        }

        if (options && options.extra_params && typeof options.extra_params === 'object') {
            request = extend(request, options.extra_params);
        }

        root.ele(request);
        var xml = root.end({pretty: $scope.options.pretty});
        //console.log(xml);
        console.log("Pickup request xml: " + JSON.stringify(xml))
        return xml;
    }

    $scope.handlePickupAvailabilityResponse = function(json, callback) {
        console.log("Pickup avail resp: " + JSON.stringify(json))
        if (json['v9:PickupAvailabilityReply']) {
            if (json['v9:PickupAvailabilityReply']['v9:HighestSeverity'] == "ERROR" || json['v9:PickupAvailabilityReply']['v9:HighestSeverity'] == "FAILURE" ) {
                return callback(json['v9:PickupAvailabilityReply']['v9:HighestSeverity'], null);
            }
        } else {
            return callback("Error parsing fedex")
        }
        return callback(null, json);
    };

    $scope.buildCreatePickupRequest = function(data, options) {
        if (!options) {
            options = {};
        }
        var root = builder.create('CreatePickupRequest', {headless: true});

        root.att('xmlns', 'http://fedex.com/ws/pickup/v9');
        $scope.buildWebAuth(root);
        $scope.buildClientDetail(root);

        var request = {
            "Version": {
                "ServiceId": "disp",
                "Major": "9",
                "Intermediate": "0",
                "Minor": "0"
            },
            "OriginDetail": buildOriginDetail(data),
            "PackageCount": data.packages.length,
            "CarrierCode": "FDXE",
        }

        if (options && options.extra_params && typeof options.extra_params === 'object') {
            request = extend(request, options.extra_params);
        }

        root.ele(request);
        var xml = root.end({pretty: $scope.options.pretty});
        //console.log(xml);
        return xml;
    }

    $scope.handleCreatePickupResponse = function(json, callback) {
        if (json['v9:CreatePickupReply']['v13:HighestSeverity'] == "ERROR") {
            return callback(json['v13:CreatePickupReply']['v13:HighestSeverity'], null);
        }
        return callback(null, json);
    };

    var resources = {
        track: { p: '/xml', f: $scope.buildTrackingRequest, r: $scope.handleTrackingResponse },
        rates: { p: '/xml', f: $scope.buildRateRequest, r: $scope.handleRateResponse },
        ship: { p: '/xml', f: $scope.buildProcessShipmentRequest, r: $scope.handleProcessShipmentResponse},
        pickup: { p: '/xml', f: $scope.buildCreatePickupRequest, r: $scope.handleCreatePickupResponse },
        pickupavailability: { p: '/xml', f: $scope.buildPickupAvailabilityRequest, r: $scope.handlePickupAvailabilityResponse }
    };

    function buildResourceFunction(i, resources) {
        // TODO: this is for making multiple requests for different services for ups (might not be needed for fedex)
        if (i === 'rates') {
            return function(data, options, callback) {
                if (!callback) {
                    callback = options;
                    options = undefined;
                }

                if (data.services && data.services.length > 0) {
                    var responses = [];
                    for (var j = 0; j < data.services.length; j++) {
                        var newData = Object.create(data);
                        delete newData.services;
                        newData.service = data.services[j];

                        var opts = doBuildParams(newData, options, resources[i]);
                        doRequest(opts.params, opts.body, function(err, res) {
                            if (err) {
                                responses.push(err);
                            } else {
                                responses.push(res);
                            }

                            if (responses.length === data.services.length) {
                                return resources[i].r(responses, callback);
                            }
                        });
                    }
                    return;
                }

                var opts = doBuildParams(data, options, resources[i]);

                doRequest(opts.params, opts.body, function(err, res) {
                    if (err) {
                        return callback(err, null);
                    }
                    return resources[i].r(res, callback)
                });
            }
        } else {
            return function(data, options, callback) {
                if (!callback) {
                    callback = options;
                    options = undefined;
                }

                var opts = doBuildParams(data, options, resources[i]);

                doRequest(opts.params, opts.body, function(err, res) {
                    if (err) {
                        return callback(err, null);
                    }
                    return resources[i].r(res, callback)
                });
            }
        }
    }

    for (var i in resources) {
        $scope[i] = buildResourceFunction(i, resources);
    }

    return $scope.config(args);
}

module.exports = FedEx;

