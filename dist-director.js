if (process.argv[0].includes('bun')) {
	module.exports = require('./bun/index.ts');
} else {
	module.exports = require('./node/index.js');
}