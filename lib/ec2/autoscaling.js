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
    console.log("Finding ASGs: ", selector);
    return self.getAutoscalingGroupsByName(region, names, { getTags: true }, function(err, list){
        if ( err ) {
            console.log("Error gettings ASGs by name '"+JSON.stringify(names)+"': ", err);
            return callback(err, null);
        }

        // Filter resources according to the selector and return it!
        return callback(null, self.aws.blessResources("ASG", "AutoScalingGroupName", region, {"Instances": "EC2", "LoadBalancerNames": "ELB"}, self.aws.filterResources(list, selector)));
    });

};


// Find or just return an autoscaling group or a list of them
exports.getAutoscalingGroups = function(region, asgOrName, opts, callback) {

    var
        self = this;

    // Is it an ASG object or a list of objects?
    if ( typeof(asg) == "object" ) {
        return callback(null, [asg]);
    }

    // Is it an ASG name?
    else if ( typeof(asg) == "string" ) {
        return self.getAutoscalingGroup(region, asgOrName, opts, function(err, asg) {
            if ( err ) {
                console.log("Error getting autoscaling group by name '"+asgOrName+"': ", err);
                return callback(err, null);
            }

            if ( asg == null ) {
                console.log("Autoscaling group named '"+asgOrName+"' not found");
                return callback(null, []);
            }

            return callback(null, [asg]);
        });
    }

    // Something else
    else {
        throw new Error("Don't know what to do with ASG:", asg);
    }

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
        var list = asgList.AutoScalingGroups;

//        var list = [{"AutoScalingGroupName":"ServerJS","AutoScalingGroupARN":"arn:aws:autoscaling:eu-west-1:881829141866:autoScalingGroup:db4d870b-d480-4193-8a35-f1653c1a47cb:autoScalingGroupName/ServerJS","LaunchConfigurationName":"ServerJS_HAV","MinSize":2,"MaxSize":3,"DesiredCapacity":2,"DefaultCooldown":300,"AvailabilityZones":["eu-west-1c"],"LoadBalancerNames":["ServerJS-LB"],"TargetGroupARNs":[],"HealthCheckType":"EC2","HealthCheckGracePeriod":300,"Instances":[],"CreatedTime":"2016-04-05T18:22:50.117Z","SuspendedProcesses":[],"VPCZoneIdentifier":"subnet-39b21660","EnabledMetrics":[],"Tags":[],"TerminationPolicies":["Default"],"NewInstancesProtectedFromScaleIn":false}];

        if ( !opts.getTags )
            return callback(null, list);

        // Lookup tags
        return self.getAutoscalingGroupTags(region, names, function(err, tagsByASG){
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


// Get an autoscaling group by it's name
exports.getAutoscalingGroup = function(region, name, opts, callback) {

    // Get the ASG by name
    return this.getAutoscalingGroupsByName(region, [name], opts, function(err, list){
        if ( err ) {
            console.log("Error listing autoscaling groups by name: ", err);
            return callback(err, null);
        }

        // Empty list? Not found!
        if ( list.length == 0 ) {
            console.log("Couldn't find any ASG named '"+name+"'");
            return callback(null, null);
        }

        console.log("Found the ASG named '"+name+"', returning it!");
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

    asgNames = ['wtf'];

    // Describe the tags for every mentioned ASG name
    return asg.describeTags({Filters:[{Name: 'auto-scaling-group', Values: asgNames}]}, function(err, data) {
        if ( err ) {
            console.log("Error describing ASG tags for "+JSON.stringify(names)+": ", err);
            return callback(err, null);
        }

//        var data = { Tags: [ { ResourceId: 'ServerJS', ResourceType: 'auto-scaling-group', Key: 'TagOne', Value: 'ValueOne', PropagateAtLaunch: true }, { ResourceId: 'ServerJS', ResourceType: 'auto-scaling-group', Key: 'TagTwo', Value: 'ValueTwo', PropagateAtLaunch: true } ] };

        // Create an hash table with the ASGs
        var asgTags = {};
        asgNames.forEach(function(asgName){
            asgTags[asgName] = {};
        });

        // Read the tags into the list
        data.Tags.forEach(function(tag){
            // Ensure the ASG exists
            if ( !asgTags[tag.ResourceId] )
                asgTags[tag.ResourceId] = {};
            asgTags[tag.ResourceId][tag.Key] = tag.Value;
        });

        // If we were asked for a single ASG, return its tags straight away!
        if ( typeof names == "string" )
            asgTags = asgTags[names];

        return callback(null, asgTags);
    });

};


// Scale up/down an ASG
exports.scale = function(asg, numberOrImpact, opts, callback) {

    var
        self            = this,
        isImpact        = null,
        asgNames        = [],
        asgByName       = {},
        needToFetch     = [],
        desiredByASG    = {},
        autoscaling;

    // Validate arguments
    if ( !asg || !numberOrImpact )
        throw new Error("We need at least a region, autoscaling group and a number/asg_impact")

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
    isImpact = numberOrImpact.toString().match(/^\s*[+\-]|%\s*$/);

    // Get module set up for the requested region
    autoscaling = self.aws.getRegionModule(region, 'AutoScaling');

    // Check the asg input and mark the ASG groups we need to retrieve in case we get a relative impact
    // we accept a simple string with the ASG name
    if ( typeof asg == "string" ) {
        asgNames = [asg];
        needToFetch.push(asg);
        console.log("Need to fetch because it's a string");
    }
    // we accept an ASG object
    else if ( typeof asg == "object" && asg.AutoScalingGroupName ) {
        asgNames.push(asg.AutoScalingGroupName);
        if ( asg.DesiredCapacity == null ) {
            console.log("Need to fetch because it's got a null DC");
            needToFetch.push(asg.AutoScalingGroupName);
        }
        else
            asgByName[asg.AutoScalingGroupName] = asg;
    }
    // we accept an array of things
    else if ( asg instanceof Array ) {
        asg.forEach(function(asgElm){
            // containing a string with an ASG name
            if ( typeof asgElm == "string" ) {
                asgNames.push(asgElm);
                console.log("Need to fetch because it's a string");
                needToFetch.push(asgElm);
            }
            // cotaining an ASG object
            else if ( typeof asgElm == "object" && asg.AutoScalingGroupName ) {
                asgNames.push(asgElm.AutoScalingGroupName);
                if ( asgElm.DesiredCapacity == null ) {
                    console.log("Need to fetch because it's got a null DC");
                    needToFetch.push(asgElm.AutoScalingGroupName);
                }
                else
                    asgByName[asgElm.AutoScalingGroupName] = asgElm;
            }
        });
    }

    console.log("Scaling "+asgNames.length+" ASG's at "+region+" to "+numberOrImpact);

    // If we need to fetch some ASG
    return utils.when(isImpact && needToFetch.length > 0,
        function(next) {
            console.log("Resolving "+needToFetch.length+" autoscaling groups...");

            // Describe autoscaling groups
            return self.getAutoscalingGroupsByName(region, needToFetch, function(err, asgList) {
                if ( err ) {
                    console.log("Error getting resolving autoscaling groups by name: ", err);
                    return callback(err,null);
                }

                // Hash ASG's by Name
                asgList.forEach(function(asgItem){
                    asgByName[asgItem.AutoScalingGroupName] = asgItem;
                });

                return next(null,true);
            });
        },
        function() {
            // Set ASG's desired capacity
            if ( isImpact ) {
                var impact = numberOrImpact.toString();
                Object.keys(asgByName).forEach(function(asgName){
                    var asgItem = asgByName[asgName];
                    if ( numberOrImpact.match(/^\s*\+\s*(\d+)\s*$/) )
                        asgItem.DesiredCapacity += parseInt(RegExp.$1);
                    else if ( numberOrImpact.match(/^\s*\-\s*(\d+)\s*$/) )
                        asgItem.DesiredCapacity -= parseInt(RegExp.$1);
                    else if ( numberOrImpact.match(/^\s*\-\s*(\d+(?:\.\d+)?)\s*%\s*$/) )
                        asgItem.DesiredCapacity *= (100-parseFloat(RegExp.$1))/100;
                    else if ( numberOrImpact.match(/^\s*\+\s*(\d+(?:\.\d+)?)\s*%\s*$/) )
                        asgItem.DesiredCapacity *= 1+(parseFloat(RegExp.$1)/100);
                    desiredByASG[asgName] = Math.round(asgItem.DesiredCapacity);
                });
            }
            else if ( numberOrImpact.toString().match(/\s*(\d+)\s*$/) ) {
                var num = RegExp.$1;
                asgNames.forEach(function(asgName){
                    desiredByASG[asgName] = parseInt(num);
                });
            }

            // Change the number of desired instances
            async.map(asgNames,
                function(asgName, next){
                    var params = {
                        AutoScalingGroupName:   asgName,
                        DesiredCapacity:        desiredByASG[asgName],
                        HonorCooldown:          opts.honorCooldown || false
                    };
                    console.log("Setting ASG '"+asgName+"' desired capacity on "+region+" to "+desiredByASG[asgName]+"...");

                    // Dry run?
                    if ( opts.dryRun )
                        return next(null, desiredByASG[asgName]);

                    // Really set the desired capacity
                    return autoscaling.setDesiredCapacity(params, function(err, res){
                        if ( err ) {
                            console.log("Error setting ASG '"+asgName+"' desired capacity to "+desiredByASG[asgName]+": ", err);
                            return callback(err,null);
                        }
                        console.log("Successfully set ASG '"+asgName+"' desired capacity to "+desiredByASG[asgName]);
                        return next(null, desiredByASG[asgName]);
                    });
                },
                function(err, res){
                    if ( err ) {
                        console.log("Error scaling the supplied ASG's: ", err);
                        return callback(err, null);
                    }

                    console.log("Successfully scaled the supplied ASG's to "+res.join(', ')+"!");
                    return callback(null, res);
                }
            );
        }
    );

};
