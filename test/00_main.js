#!/usr/bin/env node

var
    sinon       = require('sinon'),
    assert      = require('assert'),
    AWS = require('..'),
    aws;

// console.log("1: ", JSON.stringify(aws.$('elb@eu-central-1'), 0, 4))
// console.log("2: ", JSON.stringify(aws.$('#jqd-Prod@eu-west-1'), 0, 4))
// console.log("3: ", JSON.stringify(aws.$('[TagName1][TagName2=TagValue2]'), 0, 4))
// console.log("4: ", JSON.stringify(aws.$('[TagName1=TagValue1][TagName2=TagValue2]'), 0, 4))
// console.log("5: ", JSON.stringify(aws.$('[TagName1^=TagValue1][TagName2*=TagValue2]'), 0, 4))
// console.log("6: ", JSON.stringify(aws.$('[TagName1|="TagValue1 something"][TagName2$=TagValue2]'), 0, 4))

// try { console.log("7: ", aws.$('#jqd-Prod#jqd-Wtf'), 0, 4) } catch(ex){ console.log(ex); }
// console.log("8: ", JSON.stringify(aws.$('elb#jqd-Prod[TagName1=TagValue1][TagName2=TagValue2]'), 0, 4))
// console.log("9: ", JSON.stringify(aws.$('elb[TagName1=TagValue1][TagName2=TagValue2]'), 0, 4))
// console.log("10: ", JSON.stringify(aws.$('elb#jqd-Prod[TagName1=TagValue1][TagName2=TagValue2] [TagName1=TagValue1][TagName2=TagValue2]'), 0, 4))
// console.log("11: ", JSON.stringify(aws.$('elb#jqd-Prod[TagName1=TagValue1][TagName2=TagValue2] > [TagName1=TagValue1][TagName2=TagValue2]'), 0, 4))
//console.log("12: ", JSON.stringify(aws.$('elb#jqd-Prod[@AttrName=AttrValue][TagName2=TagValue2] > [TagName1=TagValue1][@AttrName=AttrValue]'), 0, 4))
//console.log("12: ", JSON.stringify(aws.$('asg !elb ec2'), 0, 4))

describe('AWS module', function() {

    it('It instantiates with no configuration', function(){
        var aws = new AWS();
        assert.equal(aws != null, true, "Couldn't instantiate AWS without a configuration");
    });

    it('It instantiates with with an empty configuration', function(){
        var aws = new AWS({});
        assert.equal(aws != null, true, "Couldn't instantiate AWS with an empty configuration");
    });

    it('It instantiates supports getting a regionModule', function(){
        var aws = new AWS();
        assert.equal(typeof(aws.getRegionModule), "function", "Can't find a getRegionModule function in the AWS instance");
    });

    it('It has the $ function', function(){
        var aws = new AWS();
        assert.equal(typeof(aws.$), "function", "Can't find the $ function in the AWS instance");
    });

    it('It has the $ function', function(){
        var aws = new AWS();
        assert.equal(typeof(aws.$), "function", "Can't find the $ function in the AWS instance");
    });



});



/*
 TODO:
   - Resource children support
   - Test everything
 */
/*
aws.getResources(aws.$('elb@eu-west-1#Test[TagName1$=1][TagName2=TagValue2]'), function(err, res){
    if ( err ) {
        console.log("Error getting all elbs");
        return process.exit(-1);
    }
    console.log(res);
    return process.exit(0);
});
*/
/*
aws.getResources(aws.$('asg@eu-west-1[TagOne^=Value]'), function(err, res){
    if ( err ) {
        console.log("Error getting all ASGs");
        return process.exit(-1);
    }
    console.log(res);
    return process.exit(0);
});
*/
