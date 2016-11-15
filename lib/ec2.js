"use strict";

// Read the submodules
['elb', 'autoscaling', 'instances', 'test'].forEach(function(mod){
    exports[mod] = require('./ec2/'+mod);
});

