var
    AWS = require('./lib/'),
    aws = new AWS({regions: ['eu-west-1', 'eu-central-1']});



aws.getResources(aws.$("asg > ec2"), function(err, res){
    if ( err ) {
        console.log("ERR: ", err);
        return process.exit(-1);
    }
    console.log(JSON.stringify(res,0,4));
    return process.exit(0);
});
