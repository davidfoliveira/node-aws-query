"use strict";

function MemoryCache(conf) {

    var
        self = this;

    self._cacheMap = { };
    self.get = function(key, callback) {
        return callback(null, self._cacheMap[key]);
    };
    self.set = function(key, value, callback) {
        self._cacheMap[key] = value;
        return callback(null, value);
    };

    return this;

}

// Export my constructor
module.exports = MemoryCache;