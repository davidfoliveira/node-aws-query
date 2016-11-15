var
    autoscaling = require('../../../../lib/aws/ec2/autoscaling');

autoscaling.getAutoscalingGroupsByName('eu-west-1', [], {}, function(err,asg) {
	console.log(err);
	console.log(asg);
});
