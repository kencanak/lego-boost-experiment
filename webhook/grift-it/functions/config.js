module.exports = {
  db: {
    griftItRequestDBCollection: 'grift-it-request',
    griftItPriorityDBCollection: 'grift-it-priority',
    griftItCommandDBCollection: 'grift-it-command',
    griftItRequestCompleteDBCollection: 'grift-it-request-complete'
  },
  fireDBCommandField: {
    cancelCurrent: 'cancel_current'
  },
  intents: {
    griftIt: {
      intent: 'grift-it',
      action: 'grifter'
    },
    griftItBusy: {
      intent: 'grift-it-busy',
      action: 'doNothing'
    },
    griftItQueue: {
      intent: 'grift-it-busy-yes',
      action: 'grifter'
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
    }
  }
};