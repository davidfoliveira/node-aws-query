"use strict";

function MemoryCache(conf) {

    var
        self = this;

    self._cacheMap = { };
    self.get = function(namespace, key, callback) {
        return callback(null, self._cacheMap[namespace+":"+key]);
    };
    self.set = function(namespace, key, value, callback) {
        var
            expire = conf[namespace];

        // No cache ? Cool!
        if ( typeof expire == "number" && expire == 0 )
            return callback(null, value);
        if ( !expire )
            expire = 300;

        console.log("Caching "+namespace+":"+key+" for "+expire+" seconds");
        self._cacheMap[namespace+":"+key] = value;
        return callback(null, value);
    };

    return this;

}

// Export my constructor
module.exports = MemoryCache;