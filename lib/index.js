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
        self._regionHandlers[regModKey] = new (AWS[awsModule])();
    }
    return self._regionHandlers[regModKey];

};

