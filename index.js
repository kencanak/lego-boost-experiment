const boost = require('movehub');
const chalk = require('chalk');

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

    this.bindEvents();
  }

  init() {
    // begin watching timeout
    this.setConnectionTimeoutWatcher();

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
        this.clearConnectionTimeoutWatcher();

        this.bindLEGOHubEvent();
      });
    });
  }

  bindLEGOHubEvent() {
    this.connectedHub.on('error', (err) => {
      this._logger(`there is some issues with the connected LEGO boost - ${err}`, 'error');
    });

    this.connectedHub.on('disconnect', () => {
      this._logger('disconnected from LEGO boost', 'info');
    });

    this.connectedHub.on('distance', distance => {
      this._logger(`distance measured: ${distance / 100} cm`, 'info');
    });

    this.connectedHub.on('color', color => {
      this._logger(`color event: ${color}`, 'info');
    });

    this.connectedHub.on('port', details => {
      this._logger(`port event: ${details}`, 'info');
    });

    this.connectedHub.on('tilt', details => {
      this._logger(`tilt event: ${JSON.stringify(details)}`, 'info');
    });

    this.connectedHub.on('rotation', details => {
      this._logger(`rotation event: ${JSON.stringify(details)}`, 'info');
    });

    this.connectedHub.on('rssi', details => {
      this._logger(`rssi event: ${details}`, 'info');
    });

    this.connectedHub.on('connect', () => {
      this._logger('connected with LEGO boost', 'ok');

      //this.connectedHub.write('0d 00 81 39 11 0a e8 03 64 9B 64 7f 03');
      //this.connectedHub.motorTime('AB', 1, 50);


          this.connectedHub.motorAngle('D', 110, -75);
          setTimeout(() => {
              this.connectedHub.motorAngle('D', 110, 75);
          }, 1000);


      //this.connectedHub.write('0e 00 81 39 11 0b 5a 00 00 00 0e 64 7f 03');
      //this.connectedHub.motorAngle('A', 90, 15);
      setTimeout(() => {


          this.connectedHub.motorAngle('D', 110, 100);
          this.connectedHub.motorAngle('A', 90, -15);
          this.connectedHub.write('0f 00 81 39 11 0c 5a 00 00 00 0e f1 64 7f 03');

          this.connectedHub.write('0d 00 81 39 11 0a e8 03 9b 64 64 7f 03');
      }, 2000);
    });
  }

  setConnectionTimeoutWatcher() {
    this.timeoutWatcher = setTimeout(() => {
      if (!this.connectedHub) {
        this._logger('unable to find any LEGO boost', 'error');
      }

      if (this.currentConnectingTries < this._maxTryConnecting) {
        this._logger(`will wait for another ${this._connectionTimeout / 1000} seconds`, 'info');
        this.currentConnectingTries += 1;
        this.setConnectionTimeoutWatcher();

        return;
      }

      this._logger('reached maximum waiting time, still couldn\'t find any LEGO boost', 'error');
      process.exit();
    }, this._connectionTimeout);
  }

  clearConnectionTimeoutWatcher() {
    clearTimeout(this.timeoutWatcher);
    this.timeoutWatcher = null;
  }

  bindEvents() {
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