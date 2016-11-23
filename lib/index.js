"use strict";

var
    AWS             = require('aws-sdk'),
    selector        = require('./selector'),
    resources       = require('./resources'),
    subModules      = {};


// Read the submodules once
['cloudwatch', 'ec2'].forEach(function(mod){
    subModules[mod] = require('./'+mod);
});


// The exported constructor
module.exports = function(conf){

    var self = function(sel){
        return $(sel);
    };
    self.$    = selector.parseSelector;
    self.conf = conf;

    // Clone the submodules in order to call them with the self instance
    Object.keys(subModules).forEach(function(modName){
        self[modName] = _copyModule(subModules[modName], 3, {aws: self});
    });

    // The region handlers
    self._regionHandlers = {};

    // The modules responsible for each resource type
    self._rscModules = {
        ASG:    self.ec2.autoscaling,
        ELB:    self.ec2.elb,
        EC2:    self.ec2.instances
    };

    // My functions
    self.getRegionModule        = getRegionModule;

    // Also all the functions from resources
    Object.keys(resources).forEach(function(fnName){
        if ( typeof resources[fnName] == "function" )
            self[fnName] = resources[fnName];
    });

    return self;

};

// Copy submodule
function _copyModule(original, recursive, extraProps) {

    var
        copy = { };

    // Copy each module contents
    Object.keys(original).forEach(function(modEl){
        if ( recursive && typeof(original[modEl]) == "object" ) {
            copy[modEl] = _copyModule(original[modEl], recursive-1, extraProps);
        }
        else
            copy[modEl] = original[modEl];
    });

    // Copy the extra properties
    Object.keys(extraProps).forEach(function(prop){
        copy[prop] = extraProps[prop];
    });

    return copy;
}

// Global functions
function getRegionModule(regionName, awsModule) {

    var
        self = this,
        regModKey = regionName + "." + awsModule;

    // Get CW handler for the requested region
    if ( !self._regionHandlers[regModKey] ) {
        AWS.config.region = regionName;
//        self._regionHandlers[regModKey] = new AWSCachedRegionModule(self, awsModule, new (AWS[awsModule])());
        self._regionHandlers[regModKey] = AWSCachedRegionModule(self, awsModule, new (AWS[awsModule])());
    }
    return self._regionHandlers[regModKey];

};

function AWSCachedRegionModule(aws, moduleName, awsRealModule){

    var
        self = {};

    // Link the original module prototype
    self.prototype = awsRealModule.prototype;

    // Copy the original module properties
    Object.keys(awsRealModule).forEach(function(prop){
        self[prop] = awsRealModule[prop];
    });

    // Overwrite "describe" methods
    Object.keys(awsRealModule.constructor.prototype).forEach(function(prop){
        if ( prop.match(/^describe/) && typeof awsRealModule.constructor.prototype[prop] == "function" ) {
            console.log("Hacking "+prop);
            var realFn = awsRealModule.constructor.prototype[prop];
            self[prop] = function(){
                var args = Array.prototype.slice.call(arguments);
                console.log("Calling "+prop+"() with "+JSON.stringify(args));
                return realFn.apply(awsRealModule, arguments);
            };
        }
    });

    return self;

}