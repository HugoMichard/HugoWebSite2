const path = require('path');

module.exports = {
  entry: './js/pond/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'js/pond'),
  },
};