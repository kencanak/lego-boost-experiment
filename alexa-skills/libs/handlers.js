
const ApiAiSdk = require('apiai');
const keys = require('../keys/alexa-dialogflow-keys');

const ApiAi = ApiAiSdk(keys.apiAIDeveloperAccessToken);

const _setAlexaSessionId = (sessionId) => {
  if (sessionId.indexOf("amzn1.echo-api.session.") != -1) {
    alexaSessionId = sessionId.split('amzn1.echo-api.session.').pop();
  } else {
    alexaSessionId = sessionId.split('SessionId.').pop();
  }
};

const _isResponseIncompleted = (response) => {
  if (response.result.actionIncomplete || response.result.action === 'FALLBACK' || response.result.action === 'HELP') {
    return true;
  }

  for (var i = 0; i < response.result.contexts.length; i++) {
    if (response.result.contexts[i].lifespan > 1) {
        return true;
    }
  }

  return false;
};

module.exports = {
  'LaunchRequest': function() {
    const self = this;

    _setAlexaSessionId(self.event.session.sessionId);

    ApiAi.eventRequest({
      name: 'WELCOME'
    }, {
      sessionId: alexaSessionId
    })
    .on('response', (response) => {
      const speech = response.result.fulfillment.speech;
      self.emit(':ask', speech, speech);
    })
    .on('error', function (error) {
      console.error('ERROR IN LAUNCH REQUEST HANDLERS: ' + error.message);
      self.emit(':tell', error);
    })
    .end();
  },
  'ApiIntent': function() {
    const self = this;

    const speechInput = self.event.request.intent.slots.Text.value;

    _setAlexaSessionId(self.event.session.sessionId);

    if (speechInput) {
      ApiAi.textRequest(speechInput, {
        sessionId: alexaSessionId
      })
      .on('response', function(response) {
        const speech = response.result.fulfillment.speech;// ? response.result.fulfillment.speech : response.result.fulfillment.messages[0].displayText;

        if (_isResponseIncompleted(response)) {
          self.emit(':ask', speech, speech);
        } else {
          self.emit(':tell', speech);
        }
      })
      .on('error', function(error) {
        console.error('ERROR IN HANDLING API INTENT' + error.message);
        self.emit(':tell', error.message);
      })
      .end();
    } else {
      self.emit('Unhandled');
    }
  },
  'AMAZON.CancelIntent': function() {
    this.emit('AMAZON.StopIntent');
  },
  'AMAZON.HelpIntent': function() {
    const self = this;

    ApiAi.eventRequest({
      name: 'HELP'
    }, {
      sessionId: alexaSessionId
    })
    .on('response', function(response) {
      const speech = response.result.fulfillment.speech;
      self.emit(':ask', speech, speech);
    })
    .on('error', function(error) {
      console.error('ERROR IN HELP INTENT: ' + error.message);
      self.emit(':tell', error.message);
    })
    .end();
  },
  'AMAZON.StopIntent': function() {
    const self = this;

    ApiAi.eventRequest({
      name: 'BYE'
    }, {
      sessionId: alexaSessionId
    })
    .on('response', function(response) {
      self.emit(':tell', response.result.fulfillment.speech);
    })
    .on('error', function(error) {
      console.error('ERROR IN STOP INTENT: ' +error.message);
      self.emit(':tell', error.message);
    })
    .end();
  },
  'Unhandled': function() {
    const self = this;

    ApiAi.eventRequest({
      name: 'FALLBACK'
    }, {
      sessionId: alexaSessionId
    })
    .on('response', function(response) {
      const speech = response.result.fulfillment.speech;
      self.emit(':ask', speech, speech);
    })
    .on('error', function(error) {
      console.error('ERROR IN UNHANDLED INTENT: ' + error.message);
      self.emit(':tell', error.message);
    })
    .end();
  }
};