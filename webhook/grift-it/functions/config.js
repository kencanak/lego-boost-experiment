module.exports = {
  griftItRequestDBCollection: 'grift-it-request',
  griftItPriorityDBCollection: 'grift-it-priority',
  griftItRequestCompleteDBCollection: 'grift-it-request-complete',
  intents: {
    griftIt: {
      intent: 'grift-it',
      action: 'grifter'
    },
    griftItBusy: {
      intent: 'grift-it-busy',
      action: 'grifterBusy'
    },
    griftItQueue: {
      intent: 'grift-it-busy-yes',
      action: 'grifter'
    },
    griftItNoQueue: {
      intent: 'grift-it-busy-no',
      action: 'grifterBusy'
    },
    griftItMagic: {
      intent: 'grift-it-magic-word',
      action: 'grifterSkipQueue'
    },
    // griftItUnknownInput: {
    //   intent: 'grift-it-no-input',
    //   action: 'noInput'
    // }
  }
};