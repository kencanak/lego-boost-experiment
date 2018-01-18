'use strict';

process.env.DEBUG = 'actions-on-google:*';

const functions = require('firebase-functions');
const firebaseAdmin = require('firebase-admin');
const dialogflowApp = require('actions-on-google').DialogflowApp;

// initialise firebase admin
firebaseAdmin.initializeApp(functions.config().firebase);

const INTENTS = {
  STEPS: 'steps-cheater'
};

const DATABASE_COLLECTION = 'steps-cheater-request';

const _databaseRef = firebaseAdmin.database().ref(DATABASE_COLLECTION);

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.dialogflowFulfillment = functions.https.onRequest((request, response) => {
  // Log headers and body
  console.log(`Request headers: ${JSON.stringify(request.headers)}`);
  console.log(`Request body: ${JSON.stringify(request.body)}`);

  const assistant = new dialogflowApp({
    request: request,
    response: response
  });

  let actionMap = new Map();
  actionMap.set(INTENTS.STEPS, stepsCheater);
  assistant.handleRequest(actionMap);

  function stepsCheater(app) {
    // Get user ID from the Google Assistant through Action on Google
    // let userId = app.getUser().userId;

    console.log(`request object: ${JSON.stringify(request.body)}`);
    const data = request.body.result.parameters;

    const steps = data.move ? data.move.steps : data.wiggle.steps;

    // store request
    // Add the user to DB
    _databaseRef.push().set({
      steps: steps
    }).then(ref => {
      console.log('Added document with ID: ', ref);
    }).catch(err => {
      console.log(err);
    });
  }
});
