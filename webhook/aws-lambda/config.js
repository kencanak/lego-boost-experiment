module.exports = {
  db: {
    griftItRequestDBCollection: 'grift-it-request',
    griftItRequestCancelDBCollection: 'grift-it-cancelled',
    griftItPriorityDBCollection: 'grift-it-priority',
    griftItCommandDBCollection: 'grift-it-command',
    griftItRequestCompleteDBCollection: 'grift-it-request-completed'
  },
  fireDBCommandField: {
    cancelCurrent: 'cancel_current',
    pauseCurrent: 'pause_current'
  },
  intents: {
    griftIt: {
      intent: 'grift-it',
      action: 'grifter'
    },
    griftItOk: {
      intent: 'grift-it-ok',
      action: 'addNew'
    },
    griftItBusy: {
      intent: 'grift-it-busy',
      action: 'doNothing'
    },
    griftItQueue: {
      intent: 'grift-it-busy-yes',
      action: 'grifterAddQueue'
    },
    griftItQueueOk: {
      intent: 'grift-it-queue-ok',
      action: 'doNothing'
    },
    griftItMagic: {
      intent: 'grift-it-magic-word',
      action: 'grifterSkipQueue'
    },
    griftItStopCurrentTask: {
      intent: 'grift-it-stop-current-task',
      action: 'grifterStopCurrentTask'
    },
    griftItCurrentTaskStopped: {
      intent: 'grift-it-current-task-stopped',
      action: 'doNothing'
    },
    griftItPauseCurrentTask: {
      intent: 'grift-it-pause-current-task',
      action: 'pauseContinueTask'
    },
    griftItContinueCurrentTask: {
      intent: 'grift-it-continue-current-task',
      action: 'pauseContinueTask'
    },
    unknownInput: {
      intent: 'input.unknown',
      action: 'doNothing'
    }
  }
};