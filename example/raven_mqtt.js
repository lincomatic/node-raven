/**
 * Reads energy data from a smart meter via a RAVEn RFA-Z106 dongle (http://www.rainforestautomation.com/raven).
 * Publishes energy data to a MQTT service.
 */

var Raven = require("../lib/raven.js"),
   	mqtt = require('mqtt'),
    crypto = require('crypto');
const axios = require('axios');

var TRACE = false;

/* influx timestamp is unix nanosecond */
function rfc3339_to_ns(timestr)
{ const date=new Date(timestr);
  return date.getTime()*1000000;
}

function sendInflux(influxurl,bucket,id,measurement,value,timestamp)
{
    const url = influxurl + '/write?db='+bucket;
    const data = measurement+',id='+id.toString()+' value='+value+' '+timestamp.toString();
    if (TRACE) {
	console.log(url);
	console.log(data);
    }
    axios.post(url,data).then((response) => {
	if (TRACE) console.log(response.status);
    }).catch(function(error) {
	
    });
}

/**
 * Publishes power/energy events from a Raven USB stick to an MQTT service
 */
var RavenMqtt = function(options) {
	var self = this;
	
	// last known state
    this.state = { power: {}, energyIn: {}, energyOut: {}, energyNet: {} };
	
	// MQTT topics
	this.TOPIC_power     = options.powerPath || "/house/meter/power/demand";
	this.TOPIC_energyIn  = options.energyInPath || "/sce/energy/in";
	this.TOPIC_energyOut = options.energyOutPath || "/sce/energy/out";
	this.TOPIC_energyNet = options.energyNetPath || "/sce/energy/net";

	this.raven = new Raven(options);
	this.raven.on("open", function() {
		self._initMqtt(options);
	});
};


// handle serial port open
RavenMqtt.prototype._initMqtt = function(options) {

	var self = this;

	if (TRACE) {
		console.log('serial device open');
	}
	
	// connect to MQTT service
    var clientId = "raven_" + crypto.randomBytes(8).toString('hex');		// create a random client ID for MQTT

    var mqttClient = mqtt.connect(options.mqttUrl, {
				keepalive: 60,
	    client: clientId,
	    username: options.mqttUser,
	    password: options.mqttPass,
	    reconnectPeriod: 5000
			});

/*	var mqttClient = mqtt.createClient(options.mqttPort, options.mqttHost, {
				keepalive: 60,
	    client: clientId,
	    username: options.mqttUser,
	    password: options.mqttPass,
	    reconnectPeriod: 5000
			});
*/

	// add handlers to MQTT client
	mqttClient.on('connect', function() {
		console.log('MQTT sessionOpened');

		// subscribe to topics for requests for initial-content (state).
		mqttClient.subscribe(self.TOPIC_power+"?");
		mqttClient.subscribe(self.TOPIC_energyIn+"?");
		mqttClient.subscribe(self.TOPIC_energyOut+"?");
		mqttClient.subscribe(self.TOPIC_energyNet+"?");
	});
	mqttClient.on('close', function() {
		console.log('MQTT close');
	});
	mqttClient.on('error', function(e) {
		// ??? seems to timeout a lot
		console.log('MQTT error: ' + e);
	});
	mqttClient.addListener('message', function(topic, payload) {
		// got data from subscribed topic
		if (TRACE) {
			console.log('received ' + topic + ' : ' + payload);
		}

		// check if message is a request for current value, send response
		var i = topic.indexOf("?");
		if (i > 0) {
			var requestTopic = topic.slice(0, i);
			var responseTopic = payload;
			if (TRACE) {
				console.log("requestTopic: " + requestTopic + "  responseTopic: " + responseTopic);
			}
			if (requestTopic == self.TOPIC_power) {
				if (TRACE) {
					console.log("sending power content: " + self.state.power);
				}
				mqttClient.publish(responseTopic, JSON.stringify(self.state.power));
			}
			else if (requestTopic == self.TOPIC_energyIn) {
				if (TRACE) {
					console.log("sending energyIn content: " + self.state.energyIn);
				}
				mqttClient.publish(responseTopic, JSON.stringify(self.state.energyIn));
			}
			else if (requestTopic == self.TOPIC_energyOut) {
				if (TRACE) {
					console.log("sending energyOut content: " + self.state.energyOut);
				}
				mqttClient.publish(responseTopic, JSON.stringify(self.state.energyOut));
			}
			else if (requestTopic == self.TOPIC_energyNet) {
				if (TRACE) {
					console.log("sending energyNet content: " + self.state.energyNet);
				}
				mqttClient.publish(responseTopic, JSON.stringify(self.state.energyNet));
			}
		}
	});

	// add serial port data handler	
	self.raven.on('power', function(power) {
		self.state.power = power;
	    mqttClient.publish(self.TOPIC_power, JSON.stringify(self.state.power));
	    if (options.influxUrl != undefined) {
		sendInflux(options.influxUrl,options.influxBucket,options.influxId,"power",self.state.power.value,rfc3339_to_ns(self.state.power.timestamp));
	    }
	});

	// energy used
	self.raven.on('energy-in', function(energy) {
		self.state.energyIn = energy;
		mqttClient.publish(self.TOPIC_energyIn, JSON.stringify(self.state.energyIn));

	    if (options.influxUrl != undefined) {
		sendInflux(options.influxUrl,options.influxBucket,options.influxId,"energy_in",self.state.energyIn.value,rfc3339_to_ns(self.state.energyIn.timestamp));
	    }
	});

	// energy fed-in to the grid
	self.raven.on('energy-out', function(energy) {
		self.state.energyOut = energy;
		mqttClient.publish(self.TOPIC_energyOut, JSON.stringify(self.state.energyOut));
	    if (options.influxUrl != undefined) {
		sendInflux(options.influxUrl,options.influxBucket,options.influxId,"energy_out",self.state.energyOut.value,rfc3339_to_ns(self.state.energyOut.timestamp));
	    }
	});
	// energy fed-in to the grid
	self.raven.on('energy-net', function(energy) {
		self.state.energyNet = energy;
	    mqttClient.publish(self.TOPIC_energyNet, JSON.stringify(self.state.energyNet));
	    if (options.influxUrl != undefined) {
		sendInflux(options.influxUrl,options.influxBucket,options.influxId,"energy_net",self.state.energyNet.value,rfc3339_to_ns(self.state.energyNet.timestamp));
	    }

	});
};

exports.RavenMqtt = RavenMqtt;
