"use strict";

var
    async = require('async'),
    utils = require('./utils');


// Gets AWS resources for a parsed query (well, if it's not parsed, parse we it!)
exports.getResources = function(query, callback) {

    var
        self        = this,
        queryParts  = query.query.slice(0),
        cacheID;

    // If the query is not parsed, parse it.
    if ( typeof query == "string" )
        query = self.$(query);

    console.log("Getting resources for query "+JSON.stringify(query));

    // Is it cached ?
    return self.cache.get("selector", query._selector, function(err, value){
        if ( err ) {
            console.log("Error checking selector cache: ", err);
            return callback(err, null);
        }

        // It's cached!
        if ( value != null ) {
            console.log("Selector result is cached!");
            return callback(null, value);
        }

        // Just call the internal function
        return _getResources.call(self, queryParts, null, function(err, results){
            if ( err ) {
                console.log("Error getting query resources: ", err);
                return callback(err, null);
            }

            // Cache results
            return self.cache.set("selector", query._selector, results, function(err, value){
                if ( err ) {
                    console.log("Error caching selector results: ", err);
                    return callback(err, null);
                }

                // Just return!
                return callback(null, results);
            });
        });

    });

}

function _getResources(query, initialResSet, callback) {

    var
        self        = this,
        res         = initialResSet,
        queryParts  = query.slice(0),
        prevWasSubj = false;

    // For each query part
    return async.whilst(
        function(){ return queryParts.length > 0 },
        function(nextPart){

            // Was the previous part the subject of the selector ?
            if ( prevWasSubj ) {
                return _getResourcesSubjSel.call(self, queryParts, res, function(err, newRes){
                    if ( err ) {
                        console.log("Error processing selector after subject: ", err);
                        return nextPart(err, null);
                    }

                    res = newRes;
                    queryParts = [];
                    return nextPart(null, newRes.length);
                });
            }

            var
                part = queryParts.shift();

            prevWasSubj = part.subject;

            // If this a linking part ?
            if ( part.link ) {

                // Replace the results by all the descendents (all levels) of the current results
                if ( part.link == "all-descendants" ) {
                    console.log("Getting all the descendants of the "+res.length+" resource(s): "+_resIDs(res));
                    return self.getAllDescendents(res, function(err, descendents){
                        if ( err ) {
                            console.log("Error getting all the descendents of "+res.length+" resource(s): ", err);
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
                            console.log("Error getting all the descendents of "+res.length+" resource(s): ", err);
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
                res = self.filterResources(res, part);
                console.log("Converted in "+res.length+" after filtering");
                return setImmediate(function(){ nextPart(null, res.length); });

            }

            // Not a linking part and no results yet
            else {

                if ( part.type ) {
                    // We have a resource type! Let's go straight there!
                    return self.selectResourcesByType(part.type, part, function(err, rss){
                        if ( err ) {
                            console.log("Error selecting resources for type '"+part.type+"' and part: ", part);
                            return nextPart(err, null);
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

            // Remove duplicate requests
            res = _getResourcesUnique(res);

            console.log("Found "+res.length+" (unique) resources for the supplied query");
            return callback(null, res);
        }
    );

};

function _resIDs(res) {

    var
        idStr = "";

    res.forEach(function(el){
        idStr += el._id+",";
    });
    return idStr.substr(0,idStr.length-1);

}


// Get the resources of the supplied query but return only the top nodes (keeping the selector subject)
function _getResourcesSubjSel(query, res, callback) {

    var
        self = this;

    // Run the selectors in parallel
    return async.mapSeries(res,
        function(rsc, next){
            return _getResources.call(self, query, [rsc], function(err, selRes){
                if ( err ) {
                    console.log("Error running subject selector: ", err);
                    return next(err, null);
                }
                return next(null, selRes.length > 0 ? rsc : null);
            });
        },
        function(err, res) {
            if ( err ) {
                console.log("Error getting subject selector resources: ", err);
                return callback(err, null);
            }

            return callback(null, res.filter(function(el){ return el != null }));
        }
    );

}


// Return a list of unique resources
function _getResourcesUnique(res) {

    var
        newRes = [],
        resIds = {};

    res.forEach(function(rsc){
        if ( resIds[rsc._id] )
            return;
        resIds[rsc._id] = true;
        newRes.push(rsc);
    });

    return newRes;

}


// Bless resources (makes them objects with useful functions)
exports.blessResources = function(type, nameField, region, childCollectors, resources) {

    var
        self = this;

    // Validate
    if ( !childCollectors )
        childCollectors = {};

    // Bless each resource
    for ( var x = 0 ; x < resources.length ; x++ ) {
        // Does it have an id?
        if ( resources[x]._id )
            continue;
        resources[x] = AWSResource.apply(resources[x], [self, type, nameField, region]);
    }

    // Build the child map
    resources.forEach(function(rsc){
        if ( rsc._childMap )
            return;
        rsc._childMap = { };
        Object.keys(childCollectors).forEach(function(prop){
            var rscType = childCollectors[prop];
            if ( !rsc._childMap[rscType] )
                rsc._childMap[rscType] = [];

            utils.getAllPropertyValues(rsc, prop).forEach(function(childEl){
                rsc._childMap[rscType].push(childEl);
            });
        });
    });

    return resources;

};

// Damn a list of resources (useful for serialization)
exports.damnResources = function(resources) {

    var
        damnedResources = [];

    resources.forEach(function(el){
        damned = utils.simpleClone(el);
        delete el['_children'];
        delete el['_childMap'];
        for ( var p in damned ) {
            if ( typeof damned[p] == "function" )
                delete damned[p];
        }
        damnedResources.push(damned);
    });

    return damnedResources;

};

// Select resource by there type (it's much faster than getting everything just to find what's got the same name/tag)
exports.selectResourcesByType = function(type, selector, callback) {

    var
        self = this,
        regions = selector.region ? [selector.region] : this.conf.regions,
        res = [];

    console.log("Finding resources of the type "+type+" matching selector "+JSON.stringify(selector));

    // For each region
    return async.map(regions,
        function(region, nextRegion){

            // Search on current resource type
            console.log("Finding resources of the type "+type+" in "+region);
            return self._rscModules[type].select(region, selector, function(err, rss){
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

};


// Select resources without a type - we have to go through all the types
exports.selectResourcesNoType = function(selector, callback) {

    var
        self = this,
        res  = [];

    console.log("Finding resources of any type matching selector ", selector);

    // We do not have a resource type :-( We have to get everything.
    return async.map(Object.keys(self._rscModules),
        function(type, nextRscType) {
            return self.selectResourcesByType(type, selector, function(err, rss){
                if ( err ) {
                    console.log("Error finding resources for type '"+type+"': ", err);
                    return nextRscType(err, null);
                }

                res = res.concat(rss);
                return nextRscType(null, rss.length);
            });
        },
        function(err) {
            if ( err ) {
                console.log("Error finding resources of every type: ", err);
                return callback(err, null);
            }

            console.log("Found "+res.length+" resources of all types");
            return callback(null, res);
        }
    );

};


// Get all the descendents of a list of resources
exports.getAllDescendents = function(resources, callback) {

    var
        self        = this,
        checkNodes  = resources.concat([]),
        allChilds   = [],
        checkedIds  = {};

    return async.whilst(
        function(){
            return Object.keys(checkNodes).length > 0;
        },
        function(next){
            var rsc = checkNodes.shift();
            return rsc.getChildren(function(err, childs){
                if ( err ) {
                    console.log("Error getting resource "+rsc._id+" children: ", err);
                    return next(err, null);
                }

                allChilds = allChilds.concat(childs);

                // Add found nodes to the checklist, if they were not checked yet
                var newNodes = 0;
                childs.forEach(function(rsc){
                    if ( checkedIds[rsc._id] )
                        return;
                    checkNodes.push(rsc);
                    checkedIds[rsc._id] = true;
                    newNodes++;
                });

                return next(null, {found: childs.length, discovered: newNodes});
            });
        },
        function(err){
            if ( err ) {
                console.log("Error getting all the descendents of "+resources.length+" resource(s): ", err);
                return callback(err, null);
            }

            // Avoid duplicationg
            allChilds = _getResourcesUnique(allChilds);

            console.log("Returning "+allChilds.length+" unique resource(s) descendents");
            return callback(null, allChilds);
        }
    )

};


// Get the direct children of a list of resources
exports.getChildren = function(resources, callback) {

    console.log("Getting the children of:");

    var
        allChilds = [];


    // For each resource
    return async.map(resources,
        function(rsc, next){
            return rsc.getChildren(function(err, childs){
                if ( err ) {
                    console.log("Error getting resource "+rsc._id+" children: ", err);
                    return next(err, null);
                }

                allChilds = allChilds.concat(childs);

                return next(null, childs.length);
            });
        },
        function(err, res){
            if ( err ) {
                console.log("Error collecting children for "+resource.length+" resources");
                return callback(err, null);
            }

            // Avoid duplicationg
            allChilds = _getResourcesUnique(allChilds);

            console.log("Returning "+allChilds.length+" unique resource children");
            return callback(null, allChilds);
        }
    );

};


// Filter resources according to a selector
// Input:  (a_list_of_resources, selector)
// Output: a_filtered_list_of_resources
exports.filterResources = function(resources, selector) {

    var
        newResourceList = resources;

    if ( selector.all )
        return resources;
    if ( selector.type )
        newResourceList = this.filterByType(newResourceList, selector.type);
    if ( selector.tags )
        newResourceList = this.filterByTag(newResourceList, selector.tags);

    return newResourceList;

}


// Filter resource buy their type
exports.filterByType = function(resources, type) {

    return resources.filter(function(rsc){
        // TODO: Double check this because... it's just here because use the
        // same function on the .select of every resource module and on the
        // .getResources() flow
        return !rsc._type || rsc._type.toUpperCase() == type;
    });

};


// Filter resources by their tags
// Input:  (a_list_of_resources, a_list_of_tag_filters)
// Output: a_filtered_list_of_resources
exports.filterByTag = function(resources, tagRules) {

    var
        newResourceList = [],
        match,
        found;

    // No tags to filter? Just return the same resource list
    if ( !tagRules )
        return resources;

    // Creates the new resource list
    resources.forEach(function(rsc){
        if ( rsc.Tags && _rscMatchTag(rsc, tagRules) )
            newResourceList.push(rsc);
    });

    return newResourceList;

};

function _rscMatchTag(rsc, tagRules) {

    // For each rule
    for ( var x = 0 ; x < tagRules.length ; x++ ) {
        var
            rule      = tagRules[x],
            rTag      = rule.tag,
            rVal      = rule.value,
            rscTagVal = rsc.Tags[rTag];

        // The "exists" operator is 
        if ( rule.oper == 'exists' ) {
            if ( !rscTagVal )
                return false;
        }
        else if ( rule.oper == 'equals' ) {
            if ( !rscTagVal || rscTagVal != rVal )
                return false;
        }
        else if ( rule.oper == 'not' ) {
            if ( rscTagVal && rscTagVal == rVal )
                return false;
        }
        else if ( rule.oper == 'equal_or_start+dash' ) {
            if ( !rscTagVal || !rscTagVal.substr(0, rVal.length+1) != rVal+"-" )
                return false;
        }
        else if ( rule.oper == 'contains' ) {
            if ( !rscTagVal || !rscTagVal.indexOf(rVal) == -1 )
                return false;
        }
        else if ( rule.oper == 'contains_word' ) {
            if ( !rscTagVal ||
                (rscTagVal != rVal &&
                 rscTagVal.indexOf(" "+rVal+" ") == -1 &&
                 rscTagVal.substr(0, rVal.length+1) != rVal+" " &&
                 rscTagVal.substr(rscTagVal.length-rVal.length-1, rVal.length+1) != " "+rVal
                )
            )
                return false;
        }
        else if ( rule.oper == 'starts_with' ) {
            if ( !rscTagVal || rscTagVal.substr(0, rVal.length) != rVal )
                return false;
        }
        else if ( rule.oper == 'ends_with' ) {
            if ( !rscTagVal || rsc.Tags[rTag].substr(rscTagVal.length-rVal.length, rVal.length+1) != rVal )
                return false;
        }
    }

    return true;

}

// The generic AWS resource object
function AWSResource(aws, type, nameField, region) {

    var
        self = this;

    // Self attributes
    this._region     = region || "unknown-region";
    this._name       = utils.getPropertyValue(this, nameField),
    this._nameField  = nameField;
    this._id         = type + "#" + (this.id || this._name) + "@" + this._region;
    this._type       = type;

    // Self methods
    this.id = function(){ return this._id; };
    this.name = function(){ return this._name; };
    this.region = function(){ return this._region; };
    this.type = function(){ return this._type; };
    this.getChildren = function(callback){
        return _awsResourceGetChildren.apply(self, [aws, callback]);
    };

    return this;

}

// Get the child resources of an AWS resource
function _awsResourceGetChildren(aws, callback) {
 
    var
        self = this,
        children = [],
        childTypes;

    if ( self._children )
        return setImmediate(function(){ callback(null, self._children); });

    console.log("Resolving "+self._id+" children ", self._childMap);

    // No child types ? No children!
    childTypes = Object.keys(self._childMap);
    if ( childTypes.length == 0 )
        return callback(null, []);
 
    // Resolve children map
    return async.map(childTypes,
        function(rscType, next){
            // Not child ids? No children!
            if ( self._childMap[rscType].length == 0 )
                return next(null, []);

            return aws._rscModules[rscType].select(self._region, self._childMap[rscType], function(err, rss){
                if ( err ) {
                    console.log("Error getting resources by name '"+JSON.stringify(self._childMap[rscType])+"' for type "+rscType+": ", err);
                    return next(err, null);
                }

                // Add the resources to the global list
                children = children.concat(rss);

                return next(null, rss.length);
            });

        },
        function(err){
            if ( err ) {
                console.log("Error resolving children for "+self._id+": ", err);
                return callback(err, null);
            }

            self._children = children;

            console.log("Resolved resource "+self._id+" children. Returning "+children.length+" resources...");
            return callback(null, children);
        }
    );

}