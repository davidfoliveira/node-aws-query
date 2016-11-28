"use strict";

// Read the submodules
['mem', 'fs', 'dynamo'].forEach(function(mod){
    exports[mod] = require('./cache/'+mod);
});

