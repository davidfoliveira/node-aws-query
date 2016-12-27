"use strict";

var
    fs      = require('fs'),
    crypto  = require('crypto'),
    rmFiles = [];


function FSCache(conf) {

    var
        self = this;

    self._cacheMap = { };
    self.get = function(namespace, key, callback) {
        var
            _key        = md5(namespace+":"+key),
            expire      = conf[namespace],
            filePath    = "tmp/"+_key;

        // Just validate the expire time
        if ( typeof expire != "number" )
            expire = 300;

        // Check last modify time
        return fs.stat(filePath, function(err, stat){
            if ( err ) {
                if ( err.code == "ENOENT" )
                    return callback(null, null);
                console.log("Error stat()'ing cache file '"+filePath+"': ", err);
                return callback(err, null);
            }

            // Has it expired ?
            if ( stat.mtime < new Date() - expire ) {
                console.log("The cached item '"+namespace+":"+key+"' has expired!");
                rmFiles.push(filePath);
                return callback(null, null);
            }

            // Read cache data
            return fs.readFile(filePath, function(err, data){
                if ( err ) {
                    console.log("Can't read cache file '"+filePath+"': ", err);
                    return callback(err, null);
                }

                console.log("The item '"+namespace+":"+key+"' was found on cache! Returning it!");
                data = JSON.parse(data);
                return callback(null, data);
            })
        });
    };
    self.set = function(namespace, key, value, callback) {
        var
            _key        = md5(namespace+":"+key),
            expire      = conf[namespace],
            filePath    = "tmp/"+_key;

        // No cache ? Cool!
        if ( typeof expire == "number" && expire == 0 )
            return callback(null, value);

        console.log("Caching "+namespace+":"+key+" for "+expire+" seconds");
        return fs.writeFile(filePath+".tmp", JSON.stringify(value), function(err){
            if ( err ) {
                console.log("Error caching item '"+namespace+":"+key+"': ", err);
                return callback(err, null);
            }

            // Move it
            return fs.rename(filePath+".tmp", filePath, function(err){
                if ( err ) {
                    console.log("Error atomically moving file '"+filePath+".tmp' to '"+filePath+"': ", err);
                    return callback(err, null);
                }
                console.log("Item '"+namespace+":"+key+"' successfully cached!");
                return callback(null, value);
            });
        });
    };

    return this;

}

function md5(data) {

    return crypto.createHash('md5').update(data).digest('hex');

}


// Remove rmFiles periodically
setInterval(function(){
    if ( rmFiles.length == 0 )
        return;

    rmFiles.slice(0).forEach(function(file){
        fs.unlink(file, function(){});
    });
    rmFiles = [];

}, 10000);

// Export my constructor
module.exports = FSCache;