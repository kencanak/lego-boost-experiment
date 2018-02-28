'use strict';

const dialogflowApp = require('actions-on-google').DialogflowApp;

const appConfig = require('./config');
const Actions = require('./libs/actions');

const _actions = new Actions();

exports.handler = (event, context, callback) => {
  // this is important, so that connection to Firebase can be made
  context.callbackWaitsForEmptyEventLoop = false;

  console.log(`REQUEST-HEADERS: ${JSON.stringify(event.headers)}`);
  console.log(`REQUEST-BODY: ${JSON.stringify(event.body)}`);

  const dfApp = new dialogflowApp({
    request: event
  });

  _actions.setRequestObject(event, callback, dfApp);

  let actionMap = new Map();

  Object.keys(appConfig.intents).forEach((intentKey) => {
    const intent = appConfig.intents[intentKey];
    actionMap.set(intent.intent, () => {
      _actions[intent.action]();
    });
  });

  // An action is a string used to identify what needs to be done in fulfillment
  let action = (event.body.result.action) ? event.body.result.action : 'default';

  console.log('ACTION: ' + action);

  actionMap.get(action)();
};