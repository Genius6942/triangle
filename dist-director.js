if (process.argv[0].includes('bun')) {
	module.exports = require('./bun/index.js');
} else {
	module.exports = require('./node/index.js');
}