const boost = require('movehub');
const chalk = require('chalk');

const firebaseAdmin = require('firebase-admin');

// TODO: refactor the config file location, putting it in webhook
// due to failed in compiling and deploy to firebase
const dbDetails = require('../webhook/aws-lambda/keys/database-details');

const firebaseServiceKey = require("../webhook/aws-lambda/keys/firebase-service-key.json");

const appConfig = require('../webhook/aws-lambda/config');

class LegoBoostExperiment {
  constructor() {
    this._loggerColorMap = {
      ok: 'green',
      error: 'red',
      info: 'yellow',
      meh: 'blue'
    };

    this._connectionTimeout = 5000;
    this._maxTryConnecting = 3;
    this.currentConnectingTries = 1;
    this.timeoutWatcher = null;
    this.connectedHub = null;

    // task queue related
    this.taskList = [];
    this.priorityTask = null;
    this.currentTaskIndex = 0;

    // firebase db related
    this._db = null;
    this._requestDBRef = null;
    this._requestCompleteDBRef = null;
    this._requestCancelDBRef = null;

    this._grifterCommandDBRef = null;

    // initialise ble listener event
    this._bindBLEEvents();

    // initialise firebase connection
    this._initFirebaseConnection();

    this.stepsCount = null;

    this.cancelTask = false;
    this.pause = false;
  }

  init() {
    // begin watching timeout
    this._setConnectionTimeoutWatcher();

    // set hub-found event
    boost.on('hub-found', hubDetails => {
      // if a hub is already connected, do not attempt to re-connect
      if (this.connectedHub) {
        this._logger('already connected with a LEGO boost', 'info');
        return;
      }

      this._logger('LEGO boost found', 'info');
      this._logger(JSON.stringify(hubDetails), 'info');

      boost.connect(hubDetails.address, (err, hub) => {
        if (err) {
          this._logger('problem in connecting with LEGO boost', 'error');
          return;
        }

        this.connectedHub = hub;

        // let's clear the timeout watcher
        this._clearConnectionTimeoutWatcher();

        this._bindLEGOHubEvent();
      });
    });
  }

  _initFirebaseConnection() {
    // initialise firebase
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(firebaseServiceKey),
      databaseURL: dbDetails.databaseURL
    });

    this._db = firebaseAdmin.database();
    this._requestDBRef = this._db.ref(appConfig.db.griftItRequestDBCollection);
    this._requestCompleteDBRef = this._db.ref(appConfig.db.griftItRequestCompleteDBCollection);
    this._requestCancelDBRef = this._db.ref(appConfig.db.griftItRequestCancelDBCollection);
    this._grifterCommandDBRef = this._db.ref(appConfig.db.griftItCommandDBCollection);
    this._grifterPriorityDBRef = this._db.ref(appConfig.db.griftItPriorityDBCollection);
  }

  _attachDBListener() {
    // grab priority list
    this._grifterPriorityDBRef.on('child_added', (snapshot, prevChildKey) => {
      const doc = snapshot.val();

      this.priorityTask = {
        id: snapshot.key,
        steps: doc.steps
      };

      // cancel existing task
      this.cancelTask = true;
    });

    // let's grab the pending list
    // let's update the task list on new request added
    this._requestDBRef.once('value', (snapshot, prevChildKey) => {
      const docs = snapshot.val();

      if (docs) {
        Object.keys(docs).forEach((key) => {
          const doc = docs[key];
          this.taskList.push({
            id: snapshot.key,
            steps: doc.steps,
            code: doc.code
          });
        });
      }

      // let's grab the pending list
      // let's update the task list on new request added
      this._requestDBRef.on('child_added', (snapshot, prevChildKey) => {
        const doc = snapshot.val();

        this.taskList.push({
          id: snapshot.key,
          steps: doc.steps,
          code: doc.code
        });
      }, (errorObject) => {
        this._logger(`Problem in reading data from firebase: ${errorObject}`, 'error');
      });
    }, (errorObject) => {
      this._logger(`Problem in reading data from firebase: ${errorObject}`, 'error');
    });

    this._grifterCommandDBRef.on('value', (snapshot) => {
      const changes = snapshot.val();

      console.log('CANCELLING: ' + JSON.stringify(changes));

      // only process cancel task if there is current task running
      if (changes[appConfig.fireDBCommandField.cancelCurrent]) {
        if (this.currentTask) {
          this.cancelTask = true;
        } else {
          // update command to done
          this._updateCancelCommand(false);
        }
      }

      // check pause status
      if (this.currentTask) {
        this.pauseCurrent = changes[appConfig.fireDBCommandField.pauseCurrent];

        if (!this.pauseCurrent) {
          this._wobble();
        }
      }
    });
  }

  _updateMoveTaskToDone() {
    if (!this.currentTask) {
      this._logger('_updateMoveTaskToDone: invalid doc', 'error');
      return;
    }

     // let's remove it from the request collection
    this[this.priorityTask ? '_grifterPriorityDBRef' : '_requestDBRef']
      .child(this.currentTask.id).remove();

    // let's add the completed task into task complete collection
    this._requestCompleteDBRef.push().set(this.currentTask, () => {

      if (!this.priorityTask) {
        this.taskList.pop();
      } else {
        this.priorityTask = null;
      }

      console.log('task count left: ' + this.taskList.length);

      this._moveToNextTask();
    });
  }

  _updateMoveTaskToCancelled(moveToNextTask) {
    if (!this.currentTask) {
      this._logger('_updateMoveTaskToCancelled: invalid doc', 'error');
      return;
    }

    // let's remove it from the request collection
    this._requestDBRef.child(this.currentTask.id).remove();

    // let's add the completed task into task complete collection
    this._requestCancelDBRef.push().set(this.currentTask, (error) => {
      if (error) {
        console.log('problem in moving current task to cancel collection', 'error');
        return;
      }

      // update command to done
      this._updateCancelCommand(false)
        .then((success) => {
          this.cancelTask = false;

          // run priority task if any
          if (this.priorityTask) {
            this.currentTask = this.priorityTask;
            setTimeout(this._beginGrifter.bind(this), 5000);
            return;
          }

          if (moveToNextTask) {
            // move to next task
            this._moveToNextTask(this.currentTask);
          }
        });
    });
  }

  _updateCancelCommand(val) {
    return new Promise((resolve, reject) => {
      const updateObject = {};
      updateObject[appConfig.fireDBCommandField.cancelCurrent] = val;

      this._grifterCommandDBRef.update(updateObject, (err) => {
        if (err) {
          reject();
          return;
        }

        resolve();
      });
    });
  }

  _beginTaskQueue() {
    if (this.taskList.length === 0 || (this.taskList.length > 0 && this._isLastTask())) {
      this._logger('no more task to process, retrying in 5 seconds', 'info');
      // let's try again in 5 seconds time
      setTimeout(this._beginTaskQueue.bind(this), 5000);
      return;
    }

    this._moveToNextTask();
  }

  _beginGrifter() {
    if (this.currentTask && this.currentTask.isDone) {
      this._logger(`skipping task ${this.currentTask.id}, it's already processed.`, 'info');

      this._moveToNextTask();
      return;
    }

    this.stepsCount = 0;

    this._wobble();
  }

  _wobble() {
    if (this.cancelTask) {
      this._updateMoveTaskToCancelled(true);
      return;
    }

    // keep calling until resume
    if (this.pauseCurrent || !this.currentTask) {
      return;
    }

    console.log('current steps count: ' + this.stepsCount);

    this.connectedHub.motorAngle('D', 50, 100);

    console.log(this.angle);

    setTimeout(() => {
      console.log('move opposite direction: ' + this.angle);
      this.connectedHub.motorAngle('D', 50, -100);

      this.stepsCount = this.stepsCount + 1;

      if (this.currentTask && this.stepsCount < this.currentTask.steps) {
        setTimeout(() => {
          this._wobble();
        }, 1500);
        return;
      }

      // move to next task
      this._moveToNextTask(this.currentTask);
    }, 1500);
  }

  _moveToNextTask() {
    if (this.currentTask) {
      // update status of previous task
      this._updateMoveTaskToDone();
    }

    if (!this._isLastTask()) {
      this._logger('moving to next task', 'info');
      this.currentTaskIndex = this.taskList.length === 1 ? 0 : this.currentTaskIndex + 1;

      this.currentTask = this.taskList[this.currentTaskIndex];

      setTimeout(this._beginGrifter.bind(this), 2000);
    } else {
      this._beginTaskQueue();
    }
  }

  _isLastTask() {
    return this.currentTaskIndex === this.taskList.length - 1;
  }

  _bindLEGOHubEvent() {
    this.connectedHub.on('error', (err) => {
      this._logger(`there is some issues with the connected LEGO boost - ${err}`, 'error');
    });

    this.connectedHub.on('disconnect', () => {
      this._logger('disconnected from LEGO boost', 'info');
    });

    // this.connectedHub.on('distance', distance => {
    //   this._logger(`distance measured: ${distance / 10} cm`, 'info');
    // });

    // this.connectedHub.on('color', color => {
    //   this._logger(`color event: ${color}`, 'info');
    // });

    // this.connectedHub.on('port', details => {
    //   this._logger(`port event: ${details}`, 'info');
    // });

    // this.connectedHub.on('tilt', details => {
    //   this._logger(`tilt event: ${JSON.stringify(details)}`, 'info');
    // });

    this.connectedHub.on('rotation', details => {
      this.angle = parseInt(details.angle);
      this._logger(`rotation event: ${JSON.stringify(details)}`, 'info');
    });

    // this.connectedHub.on('rssi', details => {
    //   this._logger(`rssi event: ${details}`, 'info');
    // });

    this.connectedHub.on('connect', () => {
      this._logger('connected with LEGO boost', 'ok');

      this._logger('begin grabbing task list', 'ok');

      // listen to db event
      this._attachDBListener();

      // begin task queue
      this._beginTaskQueue();
    });
  }

  _setConnectionTimeoutWatcher() {
    this.timeoutWatcher = setTimeout(() => {
      if (!this.connectedHub) {
        this._logger('unable to find any LEGO boost', 'error');
      }

      if (this.currentConnectingTries < this._maxTryConnecting) {
        this._logger(`will wait for another ${this._connectionTimeout / 1000} seconds`, 'info');
        this.currentConnectingTries += 1;
        this._setConnectionTimeoutWatcher();

        return;
      }

      this._logger('reached maximum waiting time, still couldn\'t find any LEGO boost', 'error');
      process.exit();
    }, this._connectionTimeout);
  }

  _clearConnectionTimeoutWatcher() {
    clearTimeout(this.timeoutWatcher);
    this.timeoutWatcher = null;
  }

  _bindBLEEvents() {
    boost.on('ble-ready', status => {
      this._logger(`bluetooth ready - ${status}`, 'ok');
    });
  }

  _logger(msg, type = 'meh') {
    console.log(chalk[this._loggerColorMap[type]](msg));
  }
}

const legoBoostExperiment = new LegoBoostExperiment();

legoBoostExperiment.init();