const boost = require('movehub');
const chalk = require('chalk');

const firebaseAdmin = require('firebase-admin');
const dbDetails = require('./keys/database-details');

const firebaseServiceKey = require("./keys/firebase-service-key.json");

// TODO: refactor the config file location, putting it in webhook
// due to failed in compiling and deploy to firebase
const appConfig = require('./webhook/grift-it/functions/config');

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
    this.currentTaskIndex = 0;

    // initialise ble listener event
    this._bindBLEEvents();

    // initialise firebase connection
    this._initFirebaseConnection();
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
    this._dbRef = this._db.ref(appConfig.griftItDBCollection);
  }

  _attachDBListener() {
    this._dbRef.on('child_added', (snapshot, prevChildKey) => {
      console.log(snapshot, '-this is new data');
      const doc = snapshot.val();

      this.taskList.push({
        id: snapshot.key,
        steps: doc.steps,
        isDone: doc.isDone
      });
    }, function (errorObject) {
      this._logger(`Problem in reading data from firebase: ${errorObject}`, 'error');
    });
  }

  _updateMoveTaskToDone(id) {
    if (!id) {
      this._logger('invalid doc id to update', 'error');
      return;
    }

    const doc = {};
    doc[`${id}/isDone`] = true;
    this._dbRef.update(doc);
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
    const currentTask = this.taskList[this.currentTaskIndex];

    if (currentTask.isDone) {
      this._logger(`skipping task ${currentTask.id}, it's already processed.`, 'info');

      this._moveToNextTask();
      return;
    }

    //this.connectedHub.write('0d 00 81 39 11 0a e8 03 64 9B 64 7f 03');
    this.connectedHub.motorTime('AB', 1, 10);


    // this.connectedHub.motorAngle('D', 15, 100);

    // setTimeout(() => {
    //   this.connectedHub.motorAngle('D', 15, -100);

    //   this._moveToNextTask(currentTask);
    // }, 1000);

    this._moveToNextTask(currentTask);


    //this.connectedHub.write('0e 00 81 39 11 0b 5a 00 00 00 0e 64 7f 03');
    //this.connectedHub.motorAngle('A', 90, 15);
    // setTimeout(() => {


    //     // this.connectedHub.motorAngle('D', 110, 100);
    //     // this.connectedHub.motorAngle('A', 90, -15);
    //     this.connectedHub.write('0f 00 81 39 11 0c 5a 00 00 00 0e f1 64 7f 03');

    //     // this.connectedHub.write('0d 00 81 39 11 0a e8 03 9b 64 64 7f 03');
    // }, 2000);
  }

  _moveToNextTask(currentTask) {
    if (currentTask) {
      // update status of previous task
      this._updateMoveTaskToDone(currentTask.id);
    }

    if (!this._isLastTask()) {
      this._logger('moving to next task', 'info');
      this.currentTaskIndex = this.taskList.length === 1 ? 0 : this.currentTaskIndex + 1;

      setTimeout(this._beginGrifter.bind(this), 5000);
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

    // this.connectedHub.on('disconnect', () => {
    //   this._logger('disconnected from LEGO boost', 'info');
    // });

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

    // this.connectedHub.on('rotation', details => {
    //   this._logger(`rotation event: ${JSON.stringify(details)}`, 'info');
    // });

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