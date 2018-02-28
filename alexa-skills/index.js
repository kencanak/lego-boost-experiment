'use strict';

const AlexaSdk = require('alexa-sdk');
const AWS = require('aws-sdk');

AWS.config.update({
  region: "us-east-1"
});


const keys = require('./keys/alexa-dialogflow-keys');
const handlers = require('./libs/handlers');

let alexaSessionId = null;

exports.handler = (event, context) => {
  const alexa = AlexaSdk.handler(event, context);

  alexa.appId = keys.alexaAppId;
  alexa.registerHandlers(handlers);
  alexa.execute();
};