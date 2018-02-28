# lego-boost-experiment
> node.js interface to communicate with LEGO boost module

## Preview
TO BE ADDED

## Pre-requisites
### Hardware
1. Lego boost module :)

### Development
1. Git
2. Node.js and npm Node ^8.4.0, npm ^5.3.0
3. Workstation with Bluetooth module or external?

## Running the app
1. Go to project root
2. `npm install`
3. `npm run start`

## Project idea
1. [x] build a step count simulator
2. [x] action should be triggered by VUI - create alexa skills
3. [x] making use of firebase of real-time task list update
4. [ ] add in push notification feature, to inform user whether or not task has been completed
5. [ ] making use of distance sensor to detect if target object is in place

## Project structure
1. node server for communicating with Lego hub and firebase (for grabbing list of task to be done)
2. Firebase function to support customization of Dialogflow intent

## TODO:
1. [ ] add in interesting movements?
2. [x] integration with dialogflow + firebase + actions on google, for communicating with the Lego Boost hub
2. [ ] running the app from `Onion omega 2` - Ref: https://onion.io/omega2/

## Credits
Credits to @hobbyquaker, for the awesome node package
https://github.com/hobbyquaker/node-movehub

## Disclaimer

LEGO and BOOST are Trademarks from The LEGO Company, which does not support (most probably doesn't even know about) this project. And of course I'm not responsible for any damage on your LEGO BOOST devices.