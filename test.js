var
    AWS = require('./lib/'),
    aws = new AWS({regions: ['eu-west-1', 'eu-central-1']});



aws.getResources(aws.$("!asg elb#Test"), function(err, res){
    if ( err ) {
        console.log("ERR: ", err);
        return process.exit(-1);
    }
//    console.log(JSON.stringify(res,0,4));
    res.forEach(function(r){
        console.log(r._id);
    });
    return process.exit(0);
});
