var
    elb = require('../../../../lib/aws/ec2/elb');

elb.getELBsByName('eu-west-1', [], function(err, asg) {
    if ( err ) {
        console.log("Error getting ELBs by name: ", err);
        return process.exit(-1);
    }
    console.log(asg);
});

elb.getELBTags('eu-west-1', 'Test', function(err, data){
    if ( err ) {
        console.log("Error getting ELB tags: ", err);
        return process.exit(-1);
    }
    console.log("Tags: ", data);
});