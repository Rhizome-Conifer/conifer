var fs = require('fs');
require('babel-polyfill');

var babelrc = fs.readFileSync('.babelrc');
var babelConfig;

try {
  babelConfig = JSON.parse(babelrc);
} catch (err) {
  console.error('==> ERROR: Error parsing your .babelrc.');
  console.error(err);
}

const config = Object.assign({}, babelConfig, { ignore: /node_modules(\/|\\)(?!(react-rte))/ })

require('babel-register')(config);
