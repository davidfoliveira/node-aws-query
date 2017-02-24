"use strict";

var
    AWS             = require('aws-sdk'),
    selector        = require('./selector'),
    resources       = require('./resources'),
    cache           = require('./cache'),
    utils           = require('./utils'),
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

    // No configuration? We should at least have an empty one
    if ( !conf )
        conf = {};

    self.$     = selector.parseSelector;
    self.conf  = conf;

    // Initialize cache
    self.cache = null;
    if ( conf.cache || conf.cacheDriver ) {
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
    }

    // Some internal vars
    // The region handlers
    self._regionHandlers = {};

    // The modules responsible for each resource type
    self._rscSelectors = {};
    self._modRscType = {};


    // My internal functions
    // Register a selector function
    self._registerSelectorFn = function(tag, fn, ctx){
        self._modRscType[ctx.modName] = tag;
        console.log("self: ", ctx);
        self._rscSelectors[tag.toUpperCase()] = function(){
            return fn.apply(ctx, Array.prototype.slice.call(arguments));
        };
    };


    // Clone the submodules in order to call them with the self instance
    // This is the way we have to directly call aws.whatever.whateverz() and keep the instance context
    Object.keys(subModules).forEach(function(modName){
        self[modName] = _copyModule(subModules[modName], 3, {aws: self, modName: modName});
    });

    // My public functions
    self.getRegionModule        = getRegionModule;

    // Also all the functions from resources and selector
    [resources, selector].forEach(function(mod){
        Object.keys(mod).forEach(function(fnName){
            if ( typeof mod[fnName] == "function" )
                self[fnName] = mod[fnName];
        });
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
            extraProps.modName = modEl;
            copy[modEl] = _copyModule(original[modEl], recursive-1, extraProps);
        }
        else
            copy[modEl] = original[modEl];
    });

    // Copy the extra properties
    Object.keys(extraProps).forEach(function(prop){
        copy[prop] = extraProps[prop];
    });

    // Does it have a _init()? Call it!
    if ( typeof copy._init == "function" )
        copy._init();

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
        self._regionHandlers[regModKey] = createAWSCachedRegionModule(self, awsModule, regionName, new (AWS[awsModule])());
    }
    return self._regionHandlers[regModKey];

};

function createAWSCachedRegionModule(aws, moduleName, region, awsRealModule){

    var
        resourceType = aws._modRscType[moduleName.toLowerCase()],
        self;

    // What's the resource type for this module? Well... ensure we have one!
    if ( !resourceType )
        throw new Error("Can't find the resource type for '"+moduleName+"'");
    resourceType = resourceType.toLowerCase();

    // The cached region module
    function AWSCachedRegionModule(){}

    // Link the original module prototype
    AWSCachedRegionModule.prototype = awsRealModule;

    self = new AWSCachedRegionModule();

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

                    // If caching is enabled, cache it!
                    return utils.when(aws.cache,
                        function(next){
                            // console.log("Caching result: ", results, "under "+cacheID);
                            return aws.cache.set(resourceType, cacheID, results, function(err){
                                if ( err ) {
                                    console.log("Error caching '"+cacheID+"' result: ", err);
                                    return origCb(err, null);
                                }
                                return next();
                            });
                        },
                        function(){
                            // Call the original callback
                            return origCb(null, results);
                        }
                    );
                });

                // Is caching disabled?
                if ( !aws.cache )
                    return realFn.apply(awsRealModule, args);

                // Cache cache
                console.log("Checking "+cacheID+" on cache...");
                aws.cache.get(resourceType, cacheID, function(err, results){
                    if ( err ) {
                        console.log("Error checking cache for '"+cacheID+"': ", err);
                        return origCb(err, null);
                    }

                    if ( results != null ) {
                        console.log("Results of '"+cacheID+"' FOUND on cache");
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