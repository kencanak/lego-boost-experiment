const firebaseAdmin = require('firebase-admin');

const dbDetails = require('../keys/database-details');
const firebaseServiceKey = require('../keys/firebase-service-key.json');

const randomWords = require('random-words');

const appConfig = require('../config');

// initialise firebase admin
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(firebaseServiceKey),
  databaseURL: dbDetails.databaseURL
});

class Actions {
  constructor() {
    this._databaseRef = firebaseAdmin.database().ref(appConfig.db.griftItRequestDBCollection);
    this._databasePriorityRef = firebaseAdmin.database().ref(appConfig.db.griftItPriorityDBCollection);
    this._databaseCommandRef = firebaseAdmin.database().ref(appConfig.db.griftItCommandDBCollection);

    this.response = null;
    this.request = null;
    this.app = null;
  }

  setRequestObject(request, response, app) {
    this.request = request;
    this.response = response;
    this.app = app;
  }

  grifter() {
    console.log('GRIFTER');
    // Get user ID from the Google Assistant through Action on Google
    // let userId = app.getUser().userId;
    const data = this.request.body.result.parameters;

    this._databaseRef.once('value', (taskData) => {
      const totalTask = taskData.numChildren();

      console.log('total task: ', totalTask);

      if (totalTask > 0) {
        // if there are request not being processed yet, we assumed that it's busy
        // so we are triggering follow up event
        const action = appConfig.intents.griftItBusy.intent;
        const followUp = {
          'followupEvent': {
            'name': appConfig.intents.griftItBusy.intent,
            'data': {
              'queue_no': totalTask.toString()
            }
          }
        };

        this.response(null, followUp);
      } else {
        console.log('send followup intent');
        const followUp2 = {
          'followupEvent': {
            'name': appConfig.intents.griftItOk.intent,
            'data': {
              'move': data.move
            }
          }
        };

        this.response(null, followUp2);
      }
    });
  }

  addNew() {
    const data = this.request.body.result.parameters;

    this._addTask(data);

    this.response(null, 'ok');
  }

  pauseContinueTask() {
    const data = this.request.body.result;

    const updateObject = {};

    updateObject[appConfig.fireDBCommandField.pauseCurrent] = data.action === 'grift-it-pause-current-task';

    this._databaseCommandRef.update(updateObject, (error) => {
      if (error) {
        app.tell('problem in pausing/resuming task');
        this.response(null, 'ok');
        return;
      }

      this.response(null, 'ok');
    });
  }

  grifterAddQueue() {
    const data = this.request.body.result.parameters;

    this._addTask(data)
      .then((success) => {
        const followUp = {
          'followupEvent': {
            'name': appConfig.intents.griftItQueueOk.intent,
            'data': {
              'code': success
            }
          }
        };

        this.response(null, followUp);
      });
  }

  _addTask(data) {
    return new Promise((resolve, reject) => {
      const code = randomWords({
        exactly: 3,
        join: '-'
      });

      const pushRef = this._databaseRef.push();

      // store request
      pushRef.set({
        steps: data.move.steps,
        code: code
      }, (error) => {
        if (error) {
          reject();
          return;
        }
        resolve(code);
      });
    });
  }

  grifterStopCurrentTask() {
    const updateObject = {};

    updateObject[appConfig.fireDBCommandField.cancelCurrent] = true;

    this._databaseCommandRef.update(updateObject, (error) => {
      if (error) {
        app.tell('problem in cancelling task');
        this.response(null, 'ok');
        return;
      }

      const followUp = {
        'followupEvent': {
          'name': appConfig.intents.griftItCurrentTaskStopped.intent
        }
      };

      this.response(null, followUp);
    });
  }

  grifterSkipQueue() {
    const data = this.request.body.result.parameters;

    // store priority request
    this._databasePriorityRef.push().set({
      steps: data.move.steps
    });
  }

  doNothing() {
    console.log(`DOING NOTHING - task: ${this.request.body.result.action}`);
    this.response(null, 'ok');
  }

  unknownInput() {
    const event = {
      'followupEvent': {
        'name': appConfig.intents.unknownInput.intent
      }
    };

    this.response(null, event);
  }
}

module.exports = Actions;