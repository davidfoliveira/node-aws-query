var
    AWS = require('./lib/'),
    aws = new AWS({regions: ['eu-west-1', 'eu-central-1'], cacheDriver: "fs", cache:{ec2: Infinity, elb:300, asg: Infinity}}),
    start = new Date();



aws.ec2.autoscaling.scale(aws.$('asg'), '-25%', function(err, res){
    if ( err ) {
        console.log("ERR: ", err);
        return process.exit(-1);
    }
/*    res.forEach(function(r){
        console.log(r._id);
    });
*/
    console.log(res);
    console.log("Took: ", (new Date()-start), "ms");
});
