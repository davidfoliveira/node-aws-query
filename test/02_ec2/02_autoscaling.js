"use strict";

var
    sinon       = require('sinon'),
    assert      = require('assert'),
    AWS         = require('../../../lib'),
    aws         = new AWS({regions: ['eu-west-1', 'eu-central-1']}),
    testTags    = [{ResourceId: "First", Key: "ATag", Value: "AValue"}],
    testASGs    = [{"AutoScalingGroupName":"First","AutoScalingGroupARN":"arn:aws:autoscaling:eu-west-1:881829141866:autoScalingGroup:db4d870b-d480-4193-8a35-f1653c1a47cb:autoScalingGroupName/ServerJS","LaunchConfigurationName":"ServerJS_HAV","MinSize":2,"MaxSize":3,"DesiredCapacity":2,"DefaultCooldown":300,"AvailabilityZones":["eu-west-1c"],"LoadBalancerNames":["ServerJS-LB"],"TargetGroupARNs":[],"HealthCheckType":"EC2","HealthCheckGracePeriod":300,"Instances":[],"CreatedTime":"2016-04-05T18:22:50.117Z","SuspendedProcesses":[],"VPCZoneIdentifier":"subnet-39b21660","EnabledMetrics":[],"Tags":[],"TerminationPolicies":["Default"],"NewInstancesProtectedFromScaleIn":false},{"AutoScalingGroupName":"Second","AutoScalingGroupARN":"arn:aws:autoscaling:eu-west-1:881829141866:autoScalingGroup:db4d870b-d480-4193-8a35-f1653c1a47cb:autoScalingGroupName/ServerJS","LaunchConfigurationName":"ServerJS_HAV","MinSize":2,"MaxSize":3,"DesiredCapacity":2,"DefaultCooldown":300,"AvailabilityZones":["eu-west-1c"],"LoadBalancerNames":["ServerJS-LB"],"TargetGroupARNs":[],"HealthCheckType":"EC2","HealthCheckGracePeriod":300,"Instances":[],"CreatedTime":"2016-04-05T18:22:50.117Z","SuspendedProcesses":[],"VPCZoneIdentifier":"subnet-39b21660","EnabledMetrics":[],"Tags":[],"TerminationPolicies":["Default"],"NewInstancesProtectedFromScaleIn":false}],
    testASGTags = { First: {ATag: "AValue"}, Second: {} };


describe('autoscaling', function() {

    // Tags
    describe('#Tags', function(){

        beforeEach(function(){
            var
                regionModule = aws.getRegionModule('eu-west-1', 'AutoScaling');

            sinon.stub(regionModule, 'describeTags', function(params, cb){
                return cb(null, {Tags: testTags});
            });
        });

        describe('getAutoscalingGroupTags()', function() {

            it('It should return an object', function(done){
                aws.ec2.autoscaling.getAutoscalingGroupTags('eu-west-1', [], function(err, tags) {
                    if ( err )
                        return done(err);

                    assert.equal(typeof(tags), "object", "Return type is not an object");
                    done();
                });
            });

            it('It should contain the supplied ASG names', function(done){
                aws.ec2.autoscaling.getAutoscalingGroupTags('eu-west-1', ['NotFound1', 'NotFound2'], function(err, tags) {
                    if ( err )
                        return done(err);

                    assert('NotFound1' in tags, true, "Element 'NotFound1' not found on the tags object");
                    assert('NotFound2' in tags, true, "Element 'NotFound2' not found on the tags object");
                    done();
                });
            });

            it('It should return objects of objects', function(done){
                aws.ec2.autoscaling.getAutoscalingGroupTags('eu-west-1', ['NotFound1'], function(err, tags) {
                    if ( err )
                        return done(err);

                    assert.equal(typeof(tags.NotFound1), "object", "Element 'NotFound1' not found on the tags object");
                    done();
                });
            });

            it('It shouldn\'t contain any tag for an inexistent ASG', function(done){
                aws.ec2.autoscaling.getAutoscalingGroupTags('eu-west-1', ['NotFound'], function(err, tags) {
                    if ( err )
                        return done(err);

                    assert.equal(Object.keys(tags.NotFound), 0, "Wrong number of tags for an inexistent ASG");
                    done();
                });
            });


            it('It should have the right number of tags', function(done){
                aws.ec2.autoscaling.getAutoscalingGroupTags('eu-west-1', ['First'], function(err, tags) {
                    if ( err )
                        return done(err);

                    assert.equal(Object.keys(tags.First).length, 1, "Wrong number of tags for an existent ASG with tags");
                    done();
                });
            });

        });

        // Reset
        afterEach(function(){
            var
                regionModule = aws.getRegionModule('eu-west-1', 'AutoScaling');

            regionModule.describeTags.restore();
        });

    });


    // ASGs
    describe('#ASGs', function(){

        // Setup
        beforeEach(function(){
            var
                regionModule = aws.getRegionModule('eu-west-1', 'AutoScaling');

            sinon.stub(regionModule, 'describeAutoScalingGroups', function(args, cb){
                var
                    asgs = testASGs;

                // No args? Return them all
                if ( !args || !args.AutoScalingGroupNames || args.AutoScalingGroupNames.length == 0 )
                    return cb(null, {AutoScalingGroups: asgs});

                // Filter them
                var filtered = [];
                asgs.forEach(function(asg){
                    args.AutoScalingGroupNames.forEach(function(name){
                        if ( asg.AutoScalingGroupName === name )
                            filtered.push(asg);
                    });
                });
                return cb(null, {AutoScalingGroups: filtered});
            });

            sinon.stub(aws.ec2.autoscaling, 'getAutoscalingGroupTags', function(region, names, cb){
                var obj = {};
                if ( region == "eu-west-1" ) {
                    names.forEach(function(name){
                        obj[name] = testASGTags[name];
                    });
                }
                return cb(null, obj);
            });
        });

        describe('getAutoscalingGroupsByName()', function() {

            // The tests
            it('It should return all the objects', function(done) {
                aws.ec2.autoscaling.getAutoscalingGroupsByName('eu-west-1', [], {}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(results.length, 2);
                    done();
                });
            });

            it('It should return a specific object', function(done) {
                aws.ec2.autoscaling.getAutoscalingGroupsByName('eu-west-1', ["First"], {}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(results.length, 1);
                    assert.equal(results[0].AutoScalingGroupName, "First");
                    done();
                });
            });

            it('It should return an empty list if the ASG wasn\'t found', function(done) {
                aws.ec2.autoscaling.getAutoscalingGroupsByName('eu-west-1', ["NotFound"], {}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(results.length, 0);
                    done();
                });
            });

            it('It should return multiple ASGs', function(done) {
                aws.ec2.autoscaling.getAutoscalingGroupsByName('eu-west-1', ["First", "Second"], {}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(results.length, 2, "Unexpected number of returning ASGs");
                    done();
                });
            });

            it('It shouldn\'t return duplicate items twice', function(done) {
                aws.ec2.autoscaling.getAutoscalingGroupsByName('eu-west-1', ["First", "First"], {}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(results.length, 1, "Unexpected number of returning ASGs");
                    done();
                });
            });

            it('It return a sorted list of ASGs', function(done) {
                aws.ec2.autoscaling.getAutoscalingGroupsByName('eu-west-1', ["First", "Second"], {}, function(err, results1) {
                    if ( err )
                        return done(err);

                    aws.ec2.autoscaling.getAutoscalingGroupsByName('eu-west-1', ["Second", "First"], {}, function(err, results2) {
                        if ( err )
                            return done(err);

                        assert.equal(results1[0].AutoScalingGroupName, results2[1].AutoScalingGroupName, "Returning results not respecting order (1)");
                        assert.equal(results1[1].AutoScalingGroupName, results2[0].AutoScalingGroupName, "Returning results not respecting order (2)");
                        done();
                    });
                });
            });

            it('It should return tags for ASGs with tags', function(done) {
                aws.ec2.autoscaling.getAutoscalingGroupsByName('eu-west-1', ["First"], {getTags: true}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(Object.keys(results[0].Tags).length, 1, "Tags object's content length doesn't match");
                    done();
                });
            });

            it('It shouldn\'t return tags for ASGs without tags', function(done) {
                aws.ec2.autoscaling.getAutoscalingGroupsByName('eu-west-1', ["Second"], {getTags: true}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(Object.keys(results[0].Tags).length, 0, "Tags object's content length doesn't match");
                    done();
                });
            });
        });

        describe('getAutoscalingGroupByName()', function() {

            it('It should return something', function(done){
                aws.ec2.autoscaling.getAutoscalingGroupByName('eu-west-1', "First", {}, function(err, asg) {
                    if ( err )
                        return done(err);

                    assert.notEqual(asg, null);
                    done();
                });
            });

            it('It should return null if the ASG wasn\'t found', function(done){
                aws.ec2.autoscaling.getAutoscalingGroupByName('eu-west-1', "NotFound", {}, function(err, asg) {
                    if ( err )
                        return done(err);

                    assert.equal(asg, null);
                    done();
                });
            });

            it('It should return null if undefined was specified as name', function(done){
                aws.ec2.autoscaling.getAutoscalingGroupByName('eu-west-1', undefined, {}, function(err, asg) {
                    if ( err )
                        return done(err);

                    assert.equal(asg, null);
                    done();
                });
            });

        });

        describe('select()', function(){
            it('It returns everything', function(done){
                aws.ec2.autoscaling.select('eu-west-1', {all: true}, function(err, els){
                    if ( err )
                        return done(err);
                    assert.equal(els.length, 2, "Unexpected number of resulting ASGs");
                    done();
                });
            });
            it('It returns nothing', function(done){
                aws.ec2.autoscaling.select('eu-west-1', {type: "_whatevz_"}, function(err, els){
                    if ( err )
                        return done(err);
                    assert.equal(els.length, 0, "Unexpected number of resulting ASGs");
                    done();
                });
            });
            it('It returns a single ASG by its name', function(done){
                aws.ec2.autoscaling.select('eu-west-1', {name: "First"}, function(err, els){
                    if ( err )
                        return done(err);
                    assert.equal(els.length, 1, "Unexpected number of resulting ASGs");
                    done();
                });
            });
            it('It returns a single ASG by its tags', function(done){
                aws.ec2.autoscaling.select('eu-west-1', {tags: [{tag:"ATag", oper: "exists"}]}, function(err, els){
                    if ( err )
                        return done(err);
                    assert.equal(els.length, 1, "Unexpected number of resulting ASGs");
                    done();
                });
            });
            it('It returns multiple ASGs by their names', function(done){
                aws.ec2.autoscaling.select('eu-west-1', ["First", "Second", "NotFound"], function(err, els){
                    if ( err )
                        return done(err);
                    assert.equal(els.length, 2, "Unexpected number of resulting ASGs");
                    done();
                });
            });
        });

        // Reset
        afterEach(function(){
            var
                regionModule = aws.getRegionModule('eu-west-1', 'AutoScaling');

            regionModule.describeAutoScalingGroups.restore();
            aws.ec2.autoscaling.getAutoscalingGroupTags.restore();
        });

    });

    // Scale
    describe('#Scale', function(){

        var
            parseSelector,
            getResources;

        // Setup
        beforeEach(function(){
            var
                regionModule = aws.getRegionModule('eu-west-1', 'AutoScaling');

            sinon.stub(regionModule, 'describeAutoScalingGroups', function(args, cb){
                var
                    asgs = testASGs;

                // No args? Return them all
                if ( !args || !args.AutoScalingGroupNames || args.AutoScalingGroupNames.length == 0 )
                    return cb(null, {AutoScalingGroups: asgs});

                // Filter them
                var filtered = [];
                asgs.forEach(function(asg){
                    args.AutoScalingGroupNames.forEach(function(name){
                        if ( asg.AutoScalingGroupName === name )
                            filtered.push(asg);
                    });
                });
                return cb(null, {AutoScalingGroups: filtered});
            });

            parseSelector = sinon.stub(aws.ec2.autoscaling.aws, 'parseSelector', function(sel){
                return { _selector: sel, query: [{type: "ASG"},{name: "First"}] };
            });

            getResources = sinon.stub(aws.ec2.autoscaling.aws, 'getResources', function(sel, cb){
                return cb(null, aws.ec2.autoscaling.blessResources('eu-west-1', [testASGs[0]]));
            });

            sinon.stub(regionModule, 'setDesiredCapacity', function(params, cb){
                console.log("Desired capacity: ", params);
                return cb(null, true);
            });
        });

        describe('scale()', function(){

            it('It should accept a selector', function(done) {
                aws.ec2.autoscaling.scale('#First', '+0', {}, function(err, res) {
                    if ( err )
                        return done(err);
                    assert(parseSelector.called, "parseSelector() wasn't called");
                    done();
                });
            });

            it('It should accept a previously parsed selector', function(done) {
                var parsedSelector = { _selector: "ASG#First", query: [{type: "ASG"}, {name: "First"}] };
                aws.ec2.autoscaling.scale(parsedSelector, '+0', {}, function(err, res) {
                    if ( err )
                        return done(err);
                    assert(!parseSelector.called, "parseSelector() was called");
                    done();
                });
            });

            it('It should get the resources for the supplied selector', function(done) {
                var parsedSelector = { _selector: "ASG#First", query: [{type: "ASG"}, {name: "First"}] };
                aws.ec2.autoscaling.scale(parsedSelector, '+0', {}, function(err, res) {
                    if ( err )
                        return done(err);
                    assert(getResources.called, "getResources() wasn't called");
                    done();
                });
            });

            it('It should accept a list of resources', function(done) {
                aws.ec2.autoscaling.scale(testASGs, '+0', {}, function(err, res) {
                    if ( err )
                        return done(err);
                    assert(!parseSelector.called, "parseSelector() was called when a list of resources was provided");
                    assert(!getResources.called, "getResources() was called when a list of resources was provided");
                    done();
                });
            });

        });

        afterEach(function(){
            var
                regionModule = aws.getRegionModule('eu-west-1', 'AutoScaling');

            regionModule.describeAutoScalingGroups.restore();
            regionModule.setDesiredCapacity.restore();
            parseSelector.restore();
            getResources.restore();
        });

    });

});