var
    AWS = require('./lib/'),
    aws = new AWS({regions: ['eu-west-1', 'eu-central-1'], cache:{ec2: Infinity, elb:300, asg: Infinity}, cacheDriver: "dynamo"}),
    start = new Date();



aws.getResources(aws.$('ec2'), function(err, res){
    if ( err ) {
        console.log("ERR: ", err);
        return process.exit(-1);
    }
//    console.log(JSON.stringify(res,0,4));
	console.log("Result ("+res.length+"):");
    res.forEach(function(r){
        console.log(r._id);
    });
    console.log("Took: ", (new Date()-start), "ms");

    console.log("--");
    start = new Date();
    aws.getResources(aws.$('!asg[TagOne^=Value] ec2'), function(err, res){
        if ( err ) {
            console.log("ERR: ", err);
            return process.exit(-1);
        }

        console.log("Result ("+res.length+"):");
        res.forEach(function(r){
            console.log(r._id);
        });
        console.log("Took: ", (new Date()-start), "ms");

        console.log("--");
        start = new Date();
        aws.getResources(aws.$('!asg[TagOne^=Value] ec2'), function(err, res){
            if ( err ) {
                console.log("ERR: ", err);
                return process.exit(-1);
            }

            console.log("Result ("+res.length+"):");
            res.forEach(function(r){
                console.log(r._id);
            });
            console.log("Took: ", (new Date()-start), "ms");

            return process.exit(0);
        });


    });
});
