"use strict";

var
    AWS             = require('aws-sdk'),
    async           = require('async'),
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
    self.$ = $;
    self.conf = conf;

    // Clone the submodules in order to call them with the self instance
    Object.keys(subModules).forEach(function(modName){
        self[modName] = _copyModule(subModules[modName], 3, {aws: self});
    });

    // The region handlers
    self._regionHandlers = {};

    // The modules responsible for each resource type
    self._rssModules = {
        ASG:    self.ec2.autoscaling,
        ELB:    self.ec2.elb,
        EC2:    self.ec2.instances
    };

    // My functions
    self.getRegionModule        = getRegionModule;
    self.getResources           = getResources;
    self.selectResourcesByType  = selectResourcesByType;
    self.selectResourcesNoType  = selectResourcesNoType;
    self.blessResources         = blessResources;
    self.filterResources        = filterResources;
    self.filterByTag            = filterByTag;
    self.getAllDescendents      = getAllDescendents;
    self.getChildren            = getChildren;

    return self;

};

// Copy submodule
function _copyModule(original, recursive, extraProps) {

    var
        copy = { };

    // Copy each module contents
    Object.keys(original).forEach(function(modEl){
        if ( recursive && typeof(original[modEl]) == "object" ) {
            console.log("Copying submodule "+modEl);
            copy[modEl] = _copyModule(original[modEl], recursive-1, extraProps);
            console.log("Now: ", copy[modEl]);
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


// Gets AWS resources for a parsed query (well, if it's not parsed, parse we it!)
function getResources(query, callback) {

    var
        self = this,
        res  = null;

    // If the query is not parsed, parse it.
    if ( typeof query == "string" )
        query = self.$(query);

    console.log("Getting resources for query "+JSON.stringify(query));

    // For each query part
    return async.mapSeries(query.query,
        function(part, nextPart){

            // If this a linking part ?
            if ( part.link ) {

                // Replace the results by all the descendents (all levels) of the current results
                if ( part.link == "all-descendants" ) {
                    console.log("Getting all the descendants of the "+res.length+" resources");
                    return self.getAllDescendents(res, function(err, descendents){
                        if ( err ) {
                            console.log("Error getting all the descendents of "+res.length+" resources: ", err);
                            return callback(err, null);
                        }

                        res = descendents;
                        return nextPart(null, res.length);
                    });
                }
                // Replace the results by the direct childs of the current results
                else if ( part.link == "direct-child" ) {
                    console.log("Getting the direct childs of the "+res.length+" resources");
                    return self.getChildren(res, function(err, descendents){
                        if ( err ) {
                            console.log("Error getting all the descendents of "+res.length+" resources: ", err);
                            return callback(err, null);
                        }

                        res = descendents;
                        return nextPart(null, res.length);
                    });
                }

            }

            // Not a linking part. Do we already have some results?
            else if ( res ) {

                console.log("Now we've got results: ", res.length);

            }

            // Not a linking part and no results yet
            else {

                if ( part.type ) {
                    // We have a resource type! Let's go straight there!
                    return self.selectResourcesByType(part.type, part, function(err, rss){
                        if ( err ) {
                            console.log("Error selecting resources for type '"+type+"' and part: ", part);
                            return next(err, null);
                        }
                        res = rss;

                        return nextPart(null, rss.length);
                    });
                }
                else {
                    // No resource type, we have to try every type
                    return self.selectResourcesNoType(part, function(err, rss){
                        if ( err ) {
                            console.log("Error selecting resources of any type for part: ", part);
                            return next(err, null);
                        }
                        res = rss;

                        return nextPart(null, rss.length);
                    });
                }
            }

        },
        function(err) {
            if ( err ) {
                console.log("Error getting resources for the supplied query: ", err);
                return callback(err, null);
            }

            console.log("Found "+res.length+" resources for the supplied query");
            return callback(null, res);
        }
    );

};


// Bless resources (makes them objects with useful functions)
function blessResources(type, resources, childCollectors) {

    // Validate
    if ( !childCollectors )
        childCollectors = {};

    // Bless each resource
    for ( var x = 0 ; x < resources.length ; x++ ) {
        // Already blessed ? Ignore!
        if ( resources[x]._type )
            continue;
        resources[x] = AWSResource.call(resources[x], [type]);
    }

    // Build the child map
    resources.forEach(function(rss){
        if ( rss._childMap )
            return;
        rss._childMap = { };
        Object.keys(childCollectors).forEach(function(prop){
            var rssType = childCollectors[prop];
            if ( !rss._childMap[rssType] )
                rss._childMap[rssType] = [];

            (rss[prop] || []).forEach(function(childEl){
                rss._childMap[rssType].push(childEl);
            });
        });
    });

    return resources;

};

function AWSResource(type) {

    // Self attributes
    this._type       = type;

    // Self methods
    this.getChildren = _awsResourceGetChildren;

    return this;

}

// Get the child resources of an AWS resource
function _awsResourceGetChildren(callback) {
 
    if ( this._children )
       return callback(null, this._children);
 
    // Resolve children
    Object.keys(this._childMap).forEach(function(rssType){

    });

}

// Select resource by there type (it's much faster than getting everything just to find what's got the same name/tag)
function selectResourcesByType(type, selector, callback) {

    var
        self = this,
        regions = selector.region ? [selector.region] : this.conf.regions,
        res = [];

    console.log("Finding resources of the type "+type+" matching selector "+JSON.stringify(selector));

    // For each region
    async.map(regions,
        function(region, nextRegion){

            // Search on current resource type
            console.log("Finding resources of the type "+type+" in "+region);
            return self._rssModules[type].select(region, selector, function(err, rss){
                if ( err ) {
                    console.log("Error selecting resources by type '"+type+"' for part "+JSON.stringify(selector)+": ", err);
                    return nextRegion(err, null);
                }

                // Add the resources to the global list
                res = res.concat(rss);

                return nextRegion(null, rss.length);
            });

        },
        function(err) {
            if ( err ) {
                console.log("Error selecting resources by type: ", err);
                return callback(err, null);
            }

            console.log("Found "+res.length+" resources of the type "+type);
            return callback(null, res);
        }
    );

}


// Select resources without a type - we have to go through all the types
function selectResourcesNoType(selector, callback) {

    var
        self = this,
        res  = [];

    console.log("Finding resources of any type matching selector ", selector);

    // We do not have a resource type :-( We have to get everything.
    return async.map(Object.keys(self._rssModules),
        function(type, nextRssType) {
            return self.selectResourcesByType(type, selector, function(err, rss){
                if ( err ) {
                    console.log("Error finding resources for type '"+type+"': ", err);
                    return nextRssType(err, null);
                }

                res = res.concat(rss);
                return nextRssType(null, rss.length);
            });
        },
        function(err){
            if ( err ) {
                console.log("Error finding resources of every type: ", err);
                return callback(err, null);
            }

            console.log("Found "+res.length+" resources of all types");
            return callback(null, res);
        }
    );

}


// Get all the descendents of a list of resources
function getAllDescendents(resources, callback) {

    return callback(null, []);

}


// Get the direct children of a list of resources
function getChildren(resources, callback) {

    return callback(null, []);

}


// Filter resources according to a selector
// Input:  (a_list_of_resources, selector)
// Output: a_filtered_list_of_resources
function filterResources(resources, selector) {

    var
        newResourceList = resources;

    if ( selector.Tags )
        newResourceList = this.filterByTag(resources, selector.Tags);

    return newResourceList;

};


// Filter resources by their tags
// Input:  (a_list_of_resources, a_list_of_tag_filters)
// Output: a_filtered_list_of_resources
function filterByTag(resources, tagRules) {

    var
        newResourceList = [],
        match,
        found;

    // No tags to filter? Just return the same resource list
    if ( !tagRules )
        return resources;

    // Creates the new resource list
    resources.forEach(function(rss){
        if ( rss.Tags && _rssMatchTag(rss, tagRules) )
            newResourceList.push(rss);
    });

    return newResourceList;

};

function _rssMatchTag(rss, tagRules) {

    // For each rule
    for ( var x = 0 ; x < tagRules.length ; x++ ) {
        var
            rule      = tagRules[x],
            rTag      = rule.tag,
            rVal      = rule.value,
            rssTagVal = rss.Tags[rTag];

        // The "exists" operator is 
        if ( rule.oper == 'exists' ) {
            if ( !rssTagVal )
                return false;
        }
        else if ( rule.oper == 'equals' ) {
            if ( !rssTagVal || rssTagVal != rVal )
                return false;
        }
        else if ( rule.oper == 'not' ) {
            if ( rssTagVal && rssTagVal == rVal )
                return false;
        }
        else if ( rule.oper == 'equal_or_start+dash' ) {
            if ( !rssTagVal || !rssTagVal.substr(0, rVal.length+1) != rVal+"-" )
                return false;
        }
        else if ( rule.oper == 'contains' ) {
            if ( !rssTagVal || !rssTagVal.indexOf(rVal) == -1 )
                return false;
        }
        else if ( rule.oper == 'contains_word' ) {
            if ( !rssTagVal ||
                (rssTagVal != rVal &&
                 rssTagVal.indexOf(" "+rVal+" ") == -1 &&
                 rssTagVal.substr(0, rVal.length+1) != rVal+" " &&
                 rssTagVal.substr(rssTagVal.length-rVal.length-1, rVal.length+1) != " "+rVal
                )
            )
                return false;
        }
        else if ( rule.oper == 'starts_with' ) {
            if ( !rssTagVal || rssTagVal.substr(0, rVal.length) != rVal )
                return false;
        }
        else if ( rule.oper == 'ends_with' ) {
            if ( !rssTagVal || rss.Tags[rTag].substr(rssTagVal.length-rVal.length, rVal.length+1) != rVal )
                return false;
        }
    }

    return true;

}


// Resource selector
// Here we just parse the query (because this is a synchronous function).
// It produces no more results than a parsed query object
// use getResources() to get the results of the parsed query object
var $ = function(query) {

    var
        self = this,
        initialQuery = query,
        queryGroups = [],
        operConversion = {
            '':   'exists',
            '==': 'equals',
            '=':  'equals',
            '!=': 'not',
            '|=': 'equal_or_start+dash',
            '*=': 'contains',
            '~=': 'contains_word',
            '^=': 'starts_with',
            '$=': 'ends_with'
        };

    // While we do have a query
    while ( !query.match(/^\s*$/) ) {

        var
            expr = { };

        // A resource type
        if ( query.match(/^(\w+)/) ) {
            expr.type = RegExp.$1.toUpperCase();
            if ( !self._rssModules[expr.type] )
                throw new Error("Unsupported resource type: "+expr.type);
            query = query.replace(/^\w+/, "");
        }

        // A name or region
        while ( query.match(/^([#@])([\w\-]+)/) ) {
            var
                type = RegExp.$1,
                data = RegExp.$2;

            if ( type == "#" ) {
                if ( expr.name )
                    throw new Error("Filtering twice on name: "+query);
                expr.name = data;
            }
            else if ( type == "@" ) {
                if ( expr.region )
                    throw new Error("Filtering twice on region: "+query);
                expr.region = data;
            }
            else {
                if ( expr.tag == null )
                    expr.tag = [];
                expr.tag.push(data);
            }
            query = query.replace(/^([#@][\w\-]+)/, "");
        }

        // Tags
        while ( query.match(/^\[(@?)([\w\-\.]+)\s*(?:([\|\*\~\$\!\^=]*=)\s*(?:\"([^"]*)\"|([^"][^\s\]]*)))?\s*\]/) ) {
            var
                isAttr      = RegExp.$1,
                name        = RegExp.$2,
                oper        = RegExp.$3,
                value       = RegExp.$4 || RegExp.$5;

            if ( !operConversion[oper] )
                throw new Error("Unknown operator: ", oper);
            if ( isAttr ) {
                if ( !expr.Attrs )
                    expr.Attrs = [];
                expr.Attrs.push({name: name, oper: oper, value: value});
            }
            else {
                if ( !expr.Tags )
                    expr.Tags = [];
                expr.Tags.push({tag: name, oper: operConversion[oper], value: value });
            }
            query = query.replace(/^\[(@?[\w\-\.]+)\s*(?:[\|\*\~\$\!\^=]*=\s*(?:\"([^"]*)\"|([^"][^\s\]]*)))?\s*\]/, "");
        }

        // What?
        if ( Object.keys(expr).length == 0 )
            throw new Error("Unknown selector '"+query+"'");

        // Add the expression to the list
        queryGroups.push(expr);

        // What's the linking operator?

        // A direct child of
        if ( query.match(/^\s*>\s*/) ) {
            queryGroups.push({ link: 'direct-child' });
            query = query.replace(/^\s*>\s*/, "");
        }
        else if ( query.match(/^\s+./) ) {
            queryGroups.push({ link: 'all-descendants' });
            query = query.replace(/^\s+/, "");
        }

    }

    return { _selector: initialQuery, query: queryGroups };

};