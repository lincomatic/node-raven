/**
 * Reads energy data from a smart meter via a RAVEn RFA-Z106 dongle (http://www.rainforestautomation.com/raven).
 * Publishes energy data to a MQTT service.
 */

var options = require('./settings'),
	raven = require("./raven_mqtt.js");

var TRACE = false;//true;

var meem = new raven.RavenMqtt(options);

meem.raven.on("open", function() {
	//meem.raven.restart();
	//meem.raven.getDeviceInfo();
	//meem.raven.getConnectionStatus();
	//meem.raven.getMeterList();
	//meem.raven.getMeterInfo();
});

//meem.open();
