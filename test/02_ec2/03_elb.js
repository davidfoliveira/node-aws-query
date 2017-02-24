"use strict";

var
    sinon       = require('sinon'),
    assert      = require('assert'),
    AWS         = require('../../lib'),
    aws         = new AWS({regions: ['eu-west-1', 'eu-central-1']}),
    testTags    = [{LoadBalancerName: "First", Tags:[{Key: "ATag", Value: "AValue"}]}],
    testELBs    = [
        {"LoadBalancerName":"First","DNSName":"Test-787403620.eu-west-1.elb.amazonaws.com","CanonicalHostedZoneName":"Test-787403620.eu-west-1.elb.amazonaws.com","CanonicalHostedZoneNameID":"Z32O12XQLNTSW2","ListenerDescriptions":[{"Listener":{"Protocol":"HTTP","LoadBalancerPort":80,"InstanceProtocol":"HTTP","InstancePort":80},"PolicyNames":[]}],"Policies":{"AppCookieStickinessPolicies":[],"LBCookieStickinessPolicies":[],"OtherPolicies":[]},"BackendServerDescriptions":[],"AvailabilityZones":["eu-west-1b","eu-west-1c","eu-west-1a"],"Subnets":["subnet-175ad960","subnet-39b21660","subnet-cad248af"],"VPCId":"vpc-15d27c70","Instances":[{"InstanceId":"i-bc89942b"}],"HealthCheck":{"Target":"HTTP:80/index.html","Interval":30,"Timeout":5,"UnhealthyThreshold":2,"HealthyThreshold":10},"SourceSecurityGroup":{"OwnerAlias":"881829141866","GroupName":"default"},"SecurityGroups":["sg-c0773fa5"],"CreatedTime":"2016-11-01T23:19:33.640Z","Scheme":"internet-facing"},
        {"LoadBalancerName":"Second","DNSName":"Test-787403621.eu-west-1.elb.amazonaws.com","CanonicalHostedZoneName":"Test-787403621.eu-west-1.elb.amazonaws.com","CanonicalHostedZoneNameID":"Z32O12XQLNTSW2","ListenerDescriptions":[{"Listener":{"Protocol":"HTTP","LoadBalancerPort":80,"InstanceProtocol":"HTTP","InstancePort":80},"PolicyNames":[]}],"Policies":{"AppCookieStickinessPolicies":[],"LBCookieStickinessPolicies":[],"OtherPolicies":[]},"BackendServerDescriptions":[],"AvailabilityZones":["eu-west-1b","eu-west-1c","eu-west-1a"],"Subnets":["subnet-175ad960","subnet-39b21660","subnet-cad248af"],"VPCId":"vpc-15d27c70","Instances":[{"InstanceId":"i-bc89942c"}],"HealthCheck":{"Target":"HTTP:80/index.html","Interval":30,"Timeout":5,"UnhealthyThreshold":2,"HealthyThreshold":10},"SourceSecurityGroup":{"OwnerAlias":"881829141866","GroupName":"default"},"SecurityGroups":["sg-c0773fa5"],"CreatedTime":"2016-11-01T23:19:33.640Z","Scheme":"internet-facing"}
    ],
    testELBTags = { First: {ATag: "AValue"}, Second: {} };


describe('elb', function() {

    // Tags
    describe('#Tags', function(){

        beforeEach(function(){
            var
                regionModule = aws.getRegionModule('eu-west-1', 'ELB');

            sinon.stub(regionModule, 'describeTags', function(params, cb){
                return cb(null, {TagDescriptions: testTags});
            });
        });

        describe('getELBTags()', function() {

            it('It should return an object', function(done){

                aws.ec2.elb.getELBTags('eu-west-1', [], function(err, tags) {
                    if ( err )
                        return done(err);

                    assert.equal(typeof(tags), "object", "Return type is not an object");
                    done();
                });

            });

            it('It should contain the supplied ELB names', function(done){
                aws.ec2.elb.getELBTags('eu-west-1', ['NotFound1', 'NotFound2'], function(err, tags) {
                    if ( err )
                        return done(err);

                    assert('NotFound1' in tags, true, "Element 'NotFound1' not found on the tags object");
                    assert('NotFound2' in tags, true, "Element 'NotFound2' not found on the tags object");
                    done();
                });
            });

            it('It should return objects of objects', function(done){
                aws.ec2.elb.getELBTags('eu-west-1', ['NotFound1'], function(err, tags) {
                    if ( err )
                        return done(err);

                    assert.equal(typeof(tags.NotFound1), "object", "Element 'NotFound1' not found on the tags object");
                    done();
                });
            });

            it('It shouldn\'t contain any tag for an inexistent ELB', function(done){
                aws.ec2.elb.getELBTags('eu-west-1', ['NotFound'], function(err, tags) {
                    if ( err )
                        return done(err);

                    assert.equal(Object.keys(tags.NotFound), 0, "Wrong number of tags for an inexistent ELB");
                    done();
                });
            });

            it('It should have the right number of tags', function(done){
                aws.ec2.elb.getELBTags('eu-west-1', ['First'], function(err, tags) {
                    if ( err )
                        return done(err);

                    assert.equal(Object.keys(tags.First).length, 1, "Wrong number of tags for an existent ELB with tags");
                    done();
                });
            });

        });

        // Reset
        afterEach(function(){
            var
                regionModule = aws.getRegionModule('eu-west-1', 'ELB');

            regionModule.describeTags.restore();
        });

    });

    // ELBs
    describe('#ELBs', function(){

        // Setup
        beforeEach(function(){
            var
                regionModule = aws.getRegionModule('eu-west-1', 'ELB');

            sinon.stub(regionModule, 'describeLoadBalancers', function(args, cb){
                var
                    elbs = testELBs;

                // No args? Return them all
                if ( !args || !args.LoadBalancerNames || args.LoadBalancerNames.length == 0 )
                    return cb(null, {LoadBalancerDescriptions: elbs});

                // Filter them
                var filtered = [];
                elbs.forEach(function(elb){
                    args.LoadBalancerNames.forEach(function(name){
                        if ( elb.LoadBalancerName === name )
                            filtered.push(elb);
                    });
                });
                return cb(null, {LoadBalancerDescriptions: filtered});
            });

            sinon.stub(aws.ec2.elb, 'getELBTags', function(region, names, cb){
                var obj = {};
                if ( region == "eu-west-1" ) {
                    names.forEach(function(name){
                        obj[name] = testELBTags[name];
                    });
                }
                return cb(null, obj);
            });
        });

        describe('getELBsByName()', function() {

            // The tests
            it('It should return all the objects', function(done) {
                aws.ec2.elb.getELBsByName('eu-west-1', [], {}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(results.length, 2);
                    done();
                });
            });

            it('It should return a specific object', function(done) {
                aws.ec2.elb.getELBsByName('eu-west-1', ["First"], {}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(results.length, 1);
                    assert.equal(results[0].LoadBalancerName, "First");
                    done();
                });
            });

            it('It should return an empty list if the ELB wasn\'t found', function(done) {
                aws.ec2.elb.getELBsByName('eu-west-1', ["NotFound"], {}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(results.length, 0);
                    done();
                });
            });

            it('It should return multiple ELBs', function(done) {
                aws.ec2.elb.getELBsByName('eu-west-1', ["First", "Second"], {}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(results.length, 2, "Unexpected number of returning ELBs");
                    done();
                });
            });

            it('It shouldn\'t return duplicate items twice', function(done) {
                aws.ec2.elb.getELBsByName('eu-west-1', ["First", "First"], {}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(results.length, 1, "Unexpected number of returning ELBs");
                    done();
                });
            });

            it('It return a sorted list of ELBs', function(done) {
                aws.ec2.elb.getELBsByName('eu-west-1', ["First", "Second"], {}, function(err, results1) {
                    if ( err )
                        return done(err);

                    aws.ec2.elb.getELBsByName('eu-west-1', ["Second", "First"], {}, function(err, results2) {
                        if ( err )
                            return done(err);

                        assert.equal(results1[0].LoadBalancerName, results2[1].LoadBalancerName, "Returning results not respecting order (1)");
                        assert.equal(results1[1].LoadBalancerName, results2[0].LoadBalancerName, "Returning results not respecting order (2)");
                        done();
                    });
                });
            });

            it('It should return tags for ELBs with tags', function(done) {
                aws.ec2.elb.getELBsByName('eu-west-1', ["First"], {getTags: true}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(Object.keys(results[0].Tags).length, 1, "Tags object's content length doesn't match");
                    done();
                });
            });

            it('It shouldn\'t return tags for ELBs without tags', function(done) {
                aws.ec2.elb.getELBsByName('eu-west-1', ["Second"], {getTags: true}, function(err, results) {
                    if ( err )
                        return done(err);

                    assert.equal(Object.keys(results[0].Tags).length, 0, "Tags object's content length doesn't match");
                    done();
                });
            });
        });

        describe('getELBByName()', function() {

            it('It should return something', function(done){
                aws.ec2.elb.getELBByName('eu-west-1', "First", {}, function(err, elb) {
                    if ( err )
                        return done(err);

                    assert.notEqual(elb, null);
                    done();
                });
            });

            it('It should return null if the ELB wasn\'t found', function(done){
                aws.ec2.elb.getELBByName('eu-west-1', "NotFound", {}, function(err, elb) {
                    if ( err )
                        return done(err);

                    assert.equal(elb, null);
                    done();
                });
            });

            it('It should return null if undefined was specified as name', function(done){
                aws.ec2.elb.getELBByName('eu-west-1', undefined, {}, function(err, elb) {
                    if ( err )
                        return done(err);

                    assert.equal(elb, null);
                    done();
                });
            });

        });

        describe('select()', function(){
            it('It returns everything', function(done){
                aws.ec2.elb.select('eu-west-1', {all: true}, function(err, els){
                    if ( err )
                        return done(err);
                    assert.equal(els.length, 2, "Unexpected number of resulting ELBs");
                    done();
                });
            });
            it('It returns nothing', function(done){
                aws.ec2.elb.select('eu-west-1', {type: "_whatevz_"}, function(err, els){
                    if ( err )
                        return done(err);
                    assert.equal(els.length, 0, "Unexpected number of resulting ELBs");
                    done();
                });
            });
            it('It returns a single ELB by its name', function(done){
                aws.ec2.elb.select('eu-west-1', {name: "First"}, function(err, els){
                    if ( err )
                        return done(err);
                    assert.equal(els.length, 1, "Unexpected number of resulting ELBs");
                    done();
                });
            });
            it('It returns a single ELB by its tags', function(done){
                aws.ec2.elb.select('eu-west-1', {tags: [{tag:"ATag", oper: "exists"}]}, function(err, els){
                    if ( err )
                        return done(err);
                    assert.equal(els.length, 1, "Unexpected number of resulting ELBs");
                    done();
                });
            });
            it('It returns multiple ELBs by their names', function(done){
                aws.ec2.elb.select('eu-west-1', ["First", "Second", "NotFound"], function(err, els){
                    if ( err )
                        return done(err);
                    assert.equal(els.length, 2, "Unexpected number of resulting ELBs");
                    done();
                });
            });
        });

        // Reset
        afterEach(function(){
            var
                regionModule = aws.getRegionModule('eu-west-1', 'ELB');

            regionModule.describeLoadBalancers.restore();
            aws.ec2.elb.getELBTags.restore();
        });

    });


});