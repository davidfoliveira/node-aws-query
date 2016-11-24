"use strict";

var
    AWS             = require('aws-sdk'),
    selector        = require('./selector'),
    resources       = require('./resources'),
    cache           = require('./cache'),
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
    self.$     = selector.parseSelector;
    self.conf  = conf;

    // Initialize cache
    self.cache = null;
    if ( typeof conf.cacheDriver == "function" )
        self.cache = new (conf.cacheDriver)(conf.cache || {});
    else if ( typeof conf.cacheDriver == "string" ) {
        if ( !cache[conf.cacheDriver] )
            throw new Error("Unsupported cache driver: ", conf.cacheDriver);
        self.cache = new (cache[conf.cacheDriver])(conf.cache || {});
    }
    else {
        self.cache = new (cache['mem'])(conf.cache || {});
    }


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
    self._modRscType = {
        autoscaling:  "ASG",
        elb:          "ELB",
        ec2:          "EC2",
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
        self._regionHandlers[regModKey] = AWSCachedRegionModule(self, awsModule, regionName, new (AWS[awsModule])());
    }
    return self._regionHandlers[regModKey];

};

function AWSCachedRegionModule(aws, moduleName, region, awsRealModule){

    var
        self = {},
        resourceType = aws._modRscType[moduleName.toLowerCase()];

    // What's the resource type for this module? Well... ensure we have one!
    if ( !resourceType )
        throw new Error("Can't find the resource type for '"+moduleName+"'");
    resourceType = resourceType.toLowerCase();

    // Link the original module prototype
    self.prototype = awsRealModule.prototype;

    // Copy the original module properties
    Object.keys(awsRealModule).forEach(function(prop){
        self[prop] = awsRealModule[prop];
    });

    // Overwrite "describe" methods
    Object.keys(awsRealModule.constructor.prototype).forEach(function(prop){
        if ( prop.match(/^describe/) && typeof awsRealModule.constructor.prototype[prop] == "function" ) {
            var realFn = awsRealModule.constructor.prototype[prop];
            self[prop] = function(){
                var
                    args        = Array.prototype.slice.call(arguments),
                    origCb      = args.pop(),
                    argStr      = JSON.stringify(args),
                    cacheID     = region+"/"+prop+"("+argStr.substr(1,argStr.length-2)+")";

                // Add the callback that stores 
                args.push(function(err, results){
                    if ( err )
                        return origCb(err, null);

//                    console.log("Caching result: ", results, "under "+cacheID);
                    return aws.cache.set(resourceType, cacheID, results, function(err){
                        if ( err ) {
                            console.log("Error caching '"+cacheID+"' result: ", err);
                            return origCb(err, null);
                        }

                        // Call the original callback
                        return origCb(null, results);
                    });
                });

                // Check cache
                console.log("Checking "+cacheID+" on cache...");
                aws.cache.get(resourceType, cacheID, function(err, results){
                    if ( err ) {
                        console.log("Error checking cache for '"+cacheID+"': ", err);
                        return origCb(err, null);
                    }

                    if ( results != null ) {
                        console.log("Results of '"+cacheID+"' found on cache");
                        return origCb(null, results);
                    }

                    console.log("Results of '"+cacheID+"' NOT found on cache");
                    return realFn.apply(awsRealModule, args);
                });
            };
        }
    });

    return self;

}