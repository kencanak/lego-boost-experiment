'use strict';

process.env.DEBUG = 'actions-on-google:*';

const functions = require('firebase-functions');
const firebaseAdmin = require('firebase-admin');
const dialogflowApp = require('actions-on-google').DialogflowApp;

const appConfig = require('./config');

// initialise firebase admin
firebaseAdmin.initializeApp(functions.config().firebase);

const _databaseRef = firebaseAdmin.database().ref(appConfig.griftItRequestDBCollection);
const _databasePriorityRef = firebaseAdmin.database().ref(appConfig.griftItPriorityDBCollection);

const methods = {
  grifter: (request, response, app) => {
    // Get user ID from the Google Assistant through Action on Google
    // let userId = app.getUser().userId;
    const data = request.body.result.parameters;

    // store request
    // Add the user to DB
    _databaseRef.push().set({
      steps: data.move.steps
    });
  },
  grifterBusy: (request, response, app) => {
    console.log('busy');
  },
  grifterSkipQueue: (request, response, app) => {
    console.log('SKIP QUEUE');
    console.log('PARAMS DATA: ' + JSON.stringify(request.body.result.parameters));
    const data = request.body.result.parameters;

     // store request
    // Add the user to DB
    _databasePriorityRef.push().set({
      steps: data.move.steps
    });

    // app.tell('okay i am done with your request, toodles!');
    // response.status(200).end('terminating web hook request');
  },
  unknownInput: (request, response, app) => {
    console.log('call this unknown input method');
    console.log(app.getRepromptCount() + '---');
    if (app.getRepromptCount() === 0) {
      app.ask(`What was that?`);
    } else if (app.getRepromptCount() === 1) {
      app.ask(`Sorry I didn't catch that. Could you repeat yourself?`);
    } else if (app.isFinalReprompt()) {
      app.tell(`Okay let's try this again later.`);
      response.status(200).end('terminating web hook request');
    }
  }
};

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.griftItFulfillment = functions.https.onRequest((request, response) => {
  // Log headers and body
  console.log(`Request headers: ${JSON.stringify(request.headers)}`);
  console.log(`Request body: ${JSON.stringify(request.body)}`);

  console.log(`Response body: ${JSON.stringify(response.body)}`);

  const app = new dialogflowApp({
    request: request,
    response: response
  });

  let actionMap = new Map();

  Object.keys(appConfig.intents).forEach((intentKey) => {
    const intent = appConfig.intents[intentKey];
    actionMap.set(intent.intent, () => {
      methods[intent.action](request, app);
    });
  });

  // An action is a string used to identify what needs to be done in fulfillment
  let action = (request.body.result.action) ? request.body.result.action : 'default';

  if (action === 'grift-it') {
    _databaseRef.once('value', (data) => {
      if (data.numChildren() > 0) {
        console.log('I AM BUSY');
        // if there are request not being processed yet, we assumed that it's busy
        // so we are triggering follow up event
        action = appConfig.intents.griftItBusy.intent;
        const followUp = {
          "followupEvent": {
            "name": appConfig.intents.griftItBusy.intent,
            "data": {
              "steps": request.body.result.parameters.move.steps
            }
          }
        };

        response.send(followUp);
        return;
      }

      // if not busy, let's store the request
      actionMap.get(action)();
    });
  } else if (request.body.result.parameters.move) {
    if (action === 'grift-it-busy-yes') {
      actionMap.get(action)();
    } else if (action === 'grift-it-busy-no') {
      console.log('NO QUEUEUE');
      console.log(request.body.result.parameters.move);
    } else if (action === 'grift-it-magic-word') {
      console.log('MAGIC WORD IS');
      console.log(app.getRepromptCount() + '---');
      console.log(request.body.result.parameters.move);
      actionMap.get(action)();
    }
  }
});


