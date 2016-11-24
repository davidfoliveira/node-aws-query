"use strict";

// Read the submodules
['mem', 'fs'].forEach(function(mod){
    exports[mod] = require('./cache/'+mod);
});

