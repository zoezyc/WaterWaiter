const viam = require('@viamrobotics/sdk/dist/main.umd.js');
console.log('Type of viam (UMD):', typeof viam);
console.log('Keys:', Object.keys(viam));
console.log('createRobotClient:', viam.createRobotClient);
