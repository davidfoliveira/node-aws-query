 var
     async = require('async'),
     autoscaling = require('../../../lib/aws/autoscaling');

async.series(
    [
        function(next){
            autoscaling.scale('eu-west-1', ['JacquardPreProd-JacquardDirectEuWest1AutoScalingGroup-193UO71ZHICH2'], '+20%', {dryRun: true}, function(err, res) {
                if ( err ) {
                    console.log("Error: ", err);
                    return next(err,false);
                }
                console.log(res);
                return next(null,true);
            });
        },
        function(next){
            autoscaling.scale('eu-central-1', [{ AutoScalingGroupName: 'JacquardPreProd-JacquardDirectEuWest1AutoScalingGroup-193UO71ZHICH2', DesiredCapacity: 234 }], '-10%', {dryRun: true}, function(err, res) {
                if ( err ) {
                    console.log("Error: ", err);
                    return next(err,false);
                }
                console.log(res);
                return next(null,true);
            });
        },
        function(next){
            autoscaling.scale('eu-central-1', 'JacquardPreProd-JacquardDirectEuWest1AutoScalingGroup-193UO71ZHICH2', '+10%', {dryRun: true}, function(err, res) {
                if ( err ) {
                    console.log("Error: ", err);
                    return next(err,false);
                }
                console.log(res);
                return next(null,true);
            });
        }
    ],
    function(err, res){
        if ( err )
            return process.exit(-1);
        return process.exit(0);
    }
);