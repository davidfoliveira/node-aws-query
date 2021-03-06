"use strict";

var
    async       = require('async'),
    utils       = require('../utils');


// The global resource select function
exports.select = function(region, selector, callback) {

    var
        self  = this,
        names = (selector instanceof Array) ? selector : selector.name ? [selector.name] : [];

    // Get AGSs by name or get them all to filter later
    // console.log("Finding ASGs: ", selector);
    return self.getAutoscalingGroupsByName(region, names, { getTags: true }, function(err, list){
        if ( err ) {
            console.log("Error gettings ASGs by name '"+JSON.stringify(names)+"': ", err);
            return callback(err, null);
        }

        // Filter resources according to the selector and return it!
        return callback(null, self.blessResources(region, self.aws.filterResources(list, selector)));
    });

};


// The resource blesser
exports.blessResources = function(region, resources) {

    return this.aws.blessResources("ASG", "AutoScalingGroupName", region, {"Instances": "EC2", "LoadBalancerNames": "ELB"}, resources);

};


// Find or just return an autoscaling group or a list of them
exports.getAutoscalingGroups = function(region, asgOrName, opts, callback) {

    var
        self = this,
        getNames = {};

    // Not an array? Convert it!
    if ( !(asgOrName instanceof Array) )
        asgOrName = [asgOrName];

    // The names that we need to get
    for ( var x = 0 ; x < asgOrName.length ; x++ ) {
        var
            name = asgOrName[x];
        if ( typeof name != "string" )
            continue;
        if ( getNames[name] == null )
            getNames[name] = [x];
        else
            getNames[name].push(x);
    }

    // Nothing to do?
    if ( Object.keys(getNames).length == 0 ) {
        console.log("Not ASGs to resolve, returning the list straight away!");
        return callback(null, asgOrName);
    }

    // Get the ASGs
    return self.getAutoscalingGroupsByName(region, Object.keys(getNames), opts, function(err, asgs){
        if ( err ) {
            console.log("Error getting ASGs by name ("+JSON.stringify(Object.keys(getNames))+"): ", err);
            return callback(err, null);
        }

        // Add the ASGs back to the list
        asgs.forEach(function(asg){
            (getNames[asg.AutoScalingGroupName] || []).forEach(function(pos){
                asgOrName[pos] = asg;
            });
        });

        console.log("Successfully resolved "+Object.keys(getNames).length+" ASGs by name. Returning the list of "+asgOrName.length+" ASGs.");

        // Return the list
        return callback(null, asgOrName);
    });

};

// Get a list of autoscaling groups by their names
exports.getAutoscalingGroupsByName = function(region, names, opts, callback) {

    var
        self = this,
        autoscaling;

    // Get module set up for the requested region
    autoscaling = self.aws.getRegionModule(region, 'AutoScaling');

    // Describe autoscaling groups
    return autoscaling.describeAutoScalingGroups({AutoScalingGroupNames: names}, function(err, asgList) {
        if ( err ) {
            console.log("Error getting autoscaling group by name: ", err);
            return callback(err,null);
        }
        var list = _sortedItems(asgList.AutoScalingGroups, names);

        if ( !opts.getTags )
            return callback(null, list);


        // Gatter all the names from all found ELBs
        var
            foundNames = list.map(function(asgEl){ return asgEl.AutoScalingGroupName; });

        // Lookup tags
        return self.getAutoscalingGroupTags(region, foundNames, function(err, tagsByASG){
            if ( err ) {
                console.log("Error getting ELB tags for "+JSON.stringify(names)+": ", err);
                return callback(err, null);
            }

            // Link the tags
            list.forEach(function(asg){
                asg.Tags = tagsByASG[asg.AutoScalingGroupName] || [];
            });

            // Return it
            return callback(null, list);
        });
    });

};

function _sortedItems(list, names) {

    var
        elementsByName = {},
        sortedList = [];

    // No need to sort? Just return the list as it is!
    if ( names.length <= 1 )
        return list;

    // Hash the items by name
    list.forEach(function(el){
        elementsByName[el.AutoScalingGroupName] = el;
    });

    // Build the final list
    var added = [];
    names.forEach(function(name){
        if ( elementsByName[name] != null ) {
            sortedList.push(elementsByName[name]);
            elementsByName[name] = null;
            added.push(name);
        }
    });

    return sortedList;

}


// Get an autoscaling group by it's name
exports.getAutoscalingGroupByName = function(region, name, opts, callback) {

    // Get the ASG by name
    return this.getAutoscalingGroupsByName(region, [name], opts, function(err, list){
        if ( err ) {
            console.log("Error listing autoscaling groups by name: ", err);
            return callback(err, null);
        }

        // Empty list? Not found!
        if ( list.length == 0 ) {
//          console.log("Couldn't find any ASG named '"+name+"'");
            return callback(null, null);
        }

//      console.log("Found the ASG named '"+name+"', returning it!");
        // Return the first (only?) one
        return callback(null, list[0]);
    });

};

// Get the tag list for each of the specifiec ASG
exports.getAutoscalingGroupTags = function(region, names, callback) {

    var
        self = this,
        asgNames = (typeof names == "string") ? [names] : names,
        asg;

    // Get module set up for the requested region
    asg = self.aws.getRegionModule(region, 'AutoScaling');

    // Describe the tags for every mentioned ASG name
    return asg.describeTags({Filters:[{Name: 'auto-scaling-group', Values: asgNames}]}, function(err, data) {
        if ( err ) {
            console.log("Error describing ASG tags for "+JSON.stringify(names)+": ", err);
            return callback(err, null);
        }

        // Create an hash table with the ASGs
        var asgTags = {};
        asgNames.forEach(function(asgName){
            asgTags[asgName] = {};
        });

        // Read the tags into the list
        data.Tags.forEach(function(tag){
            // Ensure the ASG exists
            if ( !asgTags[tag.ResourceId] )
                return;
            asgTags[tag.ResourceId][tag.Key] = tag.Value;
        });

        // If we were asked for a single ASG, return its tags straight away!
        if ( typeof names == "string" )
            asgTags = asgTags[names];

        return callback(null, asgTags);
    });

};


// Scale up
exports.scaleUp = function(asgs, numberOrImpact, opts, callback) {

    return this.scale(asgs, '+'+numberOrImpact, opts, callback);

};


// Scale down
exports.scaleDown = function(asgs, numberOrImpact, opts, callback) {

    return this.scale(asgs, '-'+numberOrImpact, opts, callback);

};


// Scale up/down an ASG
exports.scale = function(asgs, numberOrImpact, opts, callback) {

    var
        self = this;

    // Validate/parse input
    if ( typeof opts == "function" ) {
        callback = opts;
        opts = {};
    }
    if ( !opts )
        opts = {};
    if ( !callback )
        callback = function(){};

    // Did we get a list of resources, a parsed selector or a string (the name of an ASG)?
    if ( typeof asgs == "string" )
        asgs = self.aws.parseSelector(asgs);

    // If we got a selector instead of a resource list, we need to get resources for this
    return utils.when ( typeof asgs == "object" && asgs._selector != null,
        function(next){
            console.log("Getting resources to scale!");
            return self.aws.getResources(asgs, function(err, res){
                if ( err ) {
                    console.log("Error getting ASG resources for "+JSON.stringify(asgs)+": ", err);
                    return callback(err, null);
                }

                // Replace asgs and keep going!
                asgs = res;
                return next();
            });
        },
        function(){

            var
                asgsByRegion    = {},
                desiredByRegion = {};

            // Hash ASGs by region
            asgs.forEach(function(asg){
                var
                    region = asg.region();
                if ( asg._type != "ASG" )
                    return;
                if ( !asgsByRegion[region] )
                    asgsByRegion[region] = [];
                asgsByRegion[region].push(asg);
            });

            // Scale every ASG on every region
            return async.map(Object.keys(asgsByRegion),
                function(region, next){
                    var
                        asgs = asgsByRegion[region];

                    // Scale!
                    console.log("Scaling "+asgs.length+" ASGs in "+region+"...");
                    return _scale.call(self, region, asgs, numberOrImpact, opts, function(err, res){
                        if ( err ) {
                            console.log("Error scaling ASGs in "+region+": ", err);
                            return next(err, null);
                        }

                        desiredByRegion[region] = res;
                        return next(null, res);
                    });
                },
                function(err, res){
                    if ( err ) {
                        console.log("Error scaling ASGs: ", err);
                        return callback(err, null);
                    }

                    console.log("Successfully scaled "+asgs.length+" ASGs");
                    return callback(null, desiredByRegion);
                }
            );
        }
    );

}

function _scale(region, asgs, numberOrImpact, opts, callback) {

    var
        self            = this,
        desiredByASG    = {},
        autoscaling;

    // Validate arguments
    if ( !region || !asgs || !numberOrImpact )
        throw new Error("We need at least a region, autoscaling group list and a number/asg_impact")

    if ( numberOrImpact )
        numberOrImpact = numberOrImpact.toString();
    if ( !numberOrImpact.match(/^\s*[+\-]\s*\d+\s*$|^\s*[+\-]\s*(\d+(?:\.\d+)?)%\s*$|^\s*\d+\s*$/) )
        throw new Error("Don't know what to do with this number/impact string '"+numberOrImpact+"'");

    // Autocomplete arguments
    if ( !opts && !callback ) {
        callback = function(){};
        opts = {};
    }
    if ( typeof opts == "function" ) {
        callback = opts;
        opts = {};
    }
    if ( !opts )
        opts = {};

    // Get module set up for the requested region
    autoscaling = self.aws.getRegionModule(region, 'AutoScaling');


    // Change the number of desired instances
    console.log("Scaling "+asgs.length+" ASGs in "+region+" to "+numberOrImpact);
    async.map(asgs,
        function(asg, next){
            var
                asgName = asg.AutoScalingGroupName,
                desired = _asgNewDesired(asg, numberOrImpact),
                params;

            // Is the desired capacity exactly the same as the current capacity? Just ignore it!
            if ( desired == asg.DesiredCapacity ) {
                console.log("Not scaling ASG '"+asgName+"' as desired capacity is unchanged ("+numberOrImpact+" = "+desired+")");
                desiredByASG[asgName] = desired;
                return next(null, desired);
            }

            console.log("Setting ASG '"+asgName+"' desired capacity on "+region+" to "+desired+"...");

            // Dry run?
            if ( opts.dryRun )
                return next(null, desired);

            // Really set the desired capacity
            params = {
                AutoScalingGroupName:   asgName,
                DesiredCapacity:        desired,
                HonorCooldown:          opts.honorCooldown || false
            };
            return autoscaling.setDesiredCapacity(params, function(err, res){
                if ( err ) {
                    console.log("Error setting ASG '"+asgName+"' desired capacity to "+desired+": ", err);
                    desiredByASG[asgName] = null;
                    return callback(err, null);
                }
                console.log("Successfully set ASG '"+asgName+"' desired capacity to "+desired);

                // Update the ASG object in memory
                asg.DesiredCapacity = desired;
                desiredByASG[asgName] = desired;

                // Next!
                return next(null, desired);
            });
        },
        function(err, res){
            if ( err ) {
                console.log("Error scaling the supplied ASGs in "+region+": ", err);
                return callback(err, null);
            }

            console.log("Successfully scaled the supplied ASGs in "+region+" to "+JSON.stringify(desiredByASG)+"!");
            return callback(null, desiredByASG);
        }
    );

};

function _asgNewDesired(asg, numberOrImpact) {

    var
        desired = asg.DesiredCapacity;

    // A number
    if ( numberOrImpact.match(/^\s*(\d+)\s*$/) )
        return parseInt(RegExp.$1);

    // An impact
    if ( numberOrImpact.match(/^\s*\+\s*(\d+)\s*$/) )
        desired += parseInt(RegExp.$1);
    else if ( numberOrImpact.match(/^\s*\-\s*(\d+)\s*$/) )
        desired -= parseInt(RegExp.$1);
    else if ( numberOrImpact.match(/^\s*\-\s*(\d+(?:\.\d+)?)\s*%\s*$/) )
        desired *= (100-parseFloat(RegExp.$1))/100;
    else if ( numberOrImpact.match(/^\s*\+\s*(\d+(?:\.\d+)?)\s*%\s*$/) )
        desired *= 1+(parseFloat(RegExp.$1)/100);
    else
        throw new Error("Unknown impact string format '"+numberOrImpact+"'");

    return Math.round(desired);

}


// Scale ASG by region and name
exports.scaleByRegionAndName = function(region, names, opts, callback) {

    // One or more names
    if ( !(names instanceof Array) )
        names = [names];

    // Get the ASGs by name


};


// Register selector tags
exports._init = function(){
    this.aws._registerSelectorFn('ASG', this.select, this);
};
