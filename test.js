var
    AWS = require('./lib/'),
    aws = new AWS({regions: ['eu-west-1', 'eu-central-1']});

aws.getResources(aws.$("elb"), function(err, res){
    if ( err ) {
        console.log("ERR: ", err);
        return process.exit(-1);
    }
    console.log(res);
    return process.exit(0);
});
