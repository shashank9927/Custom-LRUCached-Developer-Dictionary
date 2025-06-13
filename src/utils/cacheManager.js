const LRUCache = require('./cache.js');

// Create an instance of LRU cache with capacity of 100 terms
const wordCache = new LRUCache(100);

module.exports = wordCache;