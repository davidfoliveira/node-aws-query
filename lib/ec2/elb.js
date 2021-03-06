"use strict";

var
    utils       = require('../utils');



// The global resource select function
exports.select = function(region, selector, callback) {

    var
        self  = this,
        names = (selector instanceof Array) ? selector : selector.name ? [selector.name] : [];

    // Get ELBs by name or get them all to filter later
    // console.log("Finding ELBs: ", selector);
    return self.getELBsByName(region, names, { getTags: true }, function(err, list){
        if ( err ) {
            console.log("Error gettings ELBs by name '"+JSON.stringify(names)+"': ", err);
            return callback(err, null);
        }

        // Filter resources according to the selector and return it!
        return callback(null, self.aws.blessResources("ELB", "LoadBalancerName", region, {"Instances.InstanceId": "EC2"}, self.aws.filterResources(list, selector)));
    });

};


// Get a list of ELBs by their names
exports.getELBsByName = function(region, names, opts, callback) {

    var
        self = this,
        elb;

    // Options are... optional
    if ( typeof opts == "function" ) {
        callback = opts;
        opts = {};
    }

    // Get module set up for the requested region
    elb = self.aws.getRegionModule(region, 'ELB');

    // Describe ELBs
    return elb.describeLoadBalancers({LoadBalancerNames: names}, function(err, elbList) {
        if ( err ) {
            if ( err.code === "LoadBalancerNotFound" )
                return callback(null, []);

            console.log("Error getting ELBs by name: ", err);
            return callback(err, null);
        }

        // Should return all the ELBs
        if ( names.length == 0 )
            return callback(null, elbList.LoadBalancerDescriptions);

        var
            list  = [],
            ELBsByName = {},
            stored = {};

        // Index all the ELBs by name
        elbList.LoadBalancerDescriptions.forEach(function(elb){
            if ( !ELBsByName[elb.LoadBalancerName] )
                ELBsByName[elb.LoadBalancerName] = elb;
        });

        // Make sure they respect the input list order
        names.forEach(function(name){
            if ( !stored[name] && ELBsByName[name] ) {
                list.push(ELBsByName[name]);
                stored[name] = ELBsByName[name];
            }
        });

//            var list = [{"LoadBalancerName":"Test","DNSName":"Test-787403620.eu-west-1.elb.amazonaws.com","CanonicalHostedZoneName":"Test-787403620.eu-west-1.elb.amazonaws.com","CanonicalHostedZoneNameID":"Z32O12XQLNTSW2","ListenerDescriptions":[{"Listener":{"Protocol":"HTTP","LoadBalancerPort":80,"InstanceProtocol":"HTTP","InstancePort":80},"PolicyNames":[]}],"Policies":{"AppCookieStickinessPolicies":[],"LBCookieStickinessPolicies":[],"OtherPolicies":[]},"BackendServerDescriptions":[],"AvailabilityZones":["eu-west-1b","eu-west-1c","eu-west-1a"],"Subnets":["subnet-175ad960","subnet-39b21660","subnet-cad248af"],"VPCId":"vpc-15d27c70","Instances":[{"InstanceId":"i-bc89942b"}],"HealthCheck":{"Target":"HTTP:80/index.html","Interval":30,"Timeout":5,"UnhealthyThreshold":2,"HealthyThreshold":10},"SourceSecurityGroup":{"OwnerAlias":"881829141866","GroupName":"default"},"SecurityGroups":["sg-c0773fa5"],"CreatedTime":"2016-11-01T23:19:33.640Z","Scheme":"internet-facing"}];

        if ( !opts.getTags || list.length == 0 )
            return callback(null, list);

        // Gatter all the names from all found ELBs
        var
            foundNames = list.map(function(elbEl){ return elbEl.LoadBalancerName; });

        // Lookup tags
        return self.getELBTags(region, foundNames, function(err, tagsByELB){
            if ( err ) {
                console.log("Error getting ELB tags for "+JSON.stringify(names)+": ", err);
                return callback(err, null);
            }

            // Link the tags
            list.forEach(function(elb){
                elb.Tags = tagsByELB[elb.LoadBalancerName] || [];
            });

            // Return it
            return callback(null, list);
        });

    });

};


// Get an ELB by it's name
exports.getELBByName = function(region, name, opts, callback) {

    // Get ELBs by name
    return this.getELBsByName(region, [name], opts, function(err, list){
        if ( err ) {
            console.log("Error listing ELBs by name: ", err);
            return callback(err, null);
        }

        // Nothing was returned? Just return null
        if ( list.length == 0 ) {
            // console.log("Couldn't find any ELB named '"+name+"'");
            return callback(null, null);
        }

        // console.log("Found the ELB named '"+name+"', returning it!");
        // Return the first (only?) item
        return callback(null, list[0]);
    });

};


// Get the tag list for each of the specifiec ELB
exports.getELBTags = function(region, names, callback) {

    var
        self = this,
        elbNames = (typeof names == "string") ? [names] : names,
        elb;

    // Get module set up for the requested region
    elb = self.aws.getRegionModule(region, 'ELB');

    // Describe the tags for every mentioned ELB name
    elb.describeTags({LoadBalancerNames: elbNames}, function(err, data) {
        if ( err ) {
            console.log("Error describing ELB tags for "+JSON.stringify(names)+": ", err);
            return callback(err, null);
        }

        // Initialize the tag lists
        var elbTags = {};
        elbNames.forEach(function(elbName){
            elbTags[elbName] = {};            
        });

        // Create an hash table with the ELBs
        data.TagDescriptions.forEach(function(elb){
            // Create an hash table with tags
            var tags = {};
            elb.Tags.forEach(function(tag){
                tags[tag.Key] = tag.Value;
            });
            elbTags[elb.LoadBalancerName] = tags;
        });
//        var elbTags = { Test: { TagName2: 'TagValue2', TagName1: 'TagValue1' } }

        // If we were asked for a single ELB, return its tags straight away!
        if ( typeof names == "string" )
            elbTags = elbTags[names];

        return callback(null, elbTags);
    });

};

// Register selector tags
exports._init = function(){
    this.aws._registerSelectorFn('ELB', this.select, this);
};
