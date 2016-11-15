"use strict";

// Read the submodules
['elb', 'autoscaling', 'test'].forEach(function(mod){
    exports[mod] = require('./ec2/'+mod);
});

