'use strict';

process.env.DEBUG = 'actions-on-google:*';

const functions = require('firebase-functions');
const firebaseAdmin = require('firebase-admin');
const dialogflowApp = require('actions-on-google').DialogflowApp;
const randomWords = require('random-words');

const appConfig = require('./config');

// initialise firebase admin
firebaseAdmin.initializeApp(functions.config().firebase);

const _databaseRef = firebaseAdmin.database().ref(appConfig.griftItRequestDBCollection);
const _databasePriorityRef = firebaseAdmin.database().ref(appConfig.griftItPriorityDBCollection);
const _databaseCommandRef = firebaseAdmin.database().ref(appConfig.griftItCommandDBCollection);


// _databaseRef.on('child_removed', () => {
//   console.log('TASK DONE');
//   // ref: https://github.com/dialogflow/dialogflow-nodejs-client
//   // https://github.com/dialogflow/dialogflow-nodejs-client-v2
// });

const methods = {
  grifter: (request, response, app) => {
    // Get user ID from the Google Assistant through Action on Google
    // let userId = app.getUser().userId;
    const data = request.body.result.parameters;

    const code = randomWords({
      exactly: 3,
      join: '-'
    });

    const pushRef = _databaseRef.push();

    // store request
    pushRef.set({
      steps: data.move.steps,
      code: code
    });

    if (request.body.result.action === 'grift-it-busy-yes') {
      const followUp = {
        "followupEvent": {
          "name": appConfig.intents.griftItQueueOk.intent,
          "data": {
            "code": code
          }
        }
      };

      response.send(followUp);
    }
  },
  grifterStopCurrentTask: (request, response, app) => {
    const updateObject = {};

    updateObject[appConfig.fireDBCommandField.cancelCurrent] = true;

    _databaseCommandRef.update(updateObject);

    _databaseCommandRef.on('child_changed', (snapshot) => {
      const changes = snapshot.val();

      if (!changes) {
        const followUp = {
          "followupEvent": {
            "name": appConfig.intents.griftItCurrentTaskStopped.intent
          }
        };

        response.send(followUp);

        _databaseCommandRef.off('child_changed');
      }
    });
  },
  doNothing: (request, response, app) => {
    console.log(`DO NOTHING: ${JSON.stringify(request.body)}`);
  },
  grifterSkipQueue: (request, response, app) => {
    const data = request.body.result.parameters;

    // store priority request
    _databasePriorityRef.push().set({
      steps: data.move.steps
    });
  },
  unknownInput: (request, response, app) => {
    if (app.getRepromptCount() === 0) {
      app.ask('What was that?');
    } else if (app.getRepromptCount() === 1) {
      app.ask('Sorry I didn\'t catch that. Could you repeat yourself?');
    } else if (app.isFinalReprompt()) {
      app.tell('Okay let\'s try this again later.');
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

  const app = new dialogflowApp({
    request: request,
    response: response
  });

  let actionMap = new Map();

  Object.keys(appConfig.intents).forEach((intentKey) => {
    const intent = appConfig.intents[intentKey];
    actionMap.set(intent.intent, () => {
      methods[intent.action](request, response, app);
    });
  });

  // An action is a string used to identify what needs to be done in fulfillment
  let action = (request.body.result.action) ? request.body.result.action : 'default';

  switch (action) {
    case 'grift-it':
      _databaseRef.once('value', (data) => {
        const totalTask = data.numChildren();
        if (totalTask > 0) {
          // if there are request not being processed yet, we assumed that it's busy
          // so we are triggering follow up event
          action = appConfig.intents.griftItBusy.intent;
          const followUp = {
            "followupEvent": {
              "name": appConfig.intents.griftItBusy.intent,
              "data": {
                "queue_no": totalTask.toString()
              }
            }
          };

          response.send(followUp);
          return;
        }

        // if not busy, let's store the request
        actionMap.get(action)();
      });
      break;

    default:
      actionMap.get(action)();
      break;
  }
});


