#!/usr/bin/env node

var
    AWS = require('..'),
    aws = new AWS({regions: ['eu-central-1', 'eu-west-1']});

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


/*
 TODO:
   - Resource children support
   - Test everything
 */

aws.getResources(aws.$('elb@eu-west-1#Test[TagName1$=1][TagName2=TagValue2]'), function(err, res){
    if ( err ) {
        console.log("Error getting all elbs");
        return process.exit(-1);
    }
    console.log(res);
    return process.exit(0);
});
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
