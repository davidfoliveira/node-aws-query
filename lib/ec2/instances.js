"use strict";

var
    utils       = require('../utils');


// The global resource select function
exports.select = function(region, selector, callback) {

    var
        self  = this,
        names = (selector instanceof Array) ? selector : selector.name ? [selector.name] : [];

    // Get EC2 instances by name or get them all to filter later
    console.log("Finding instances: ", selector);
    return self.getInstancesById(region, names, { getTags: true }, function(err, list){
        if ( err ) {
            console.log("Error gettings EC2 instances by name '"+JSON.stringify(names)+"': ", err);
            return callback(err, null);
        }

        // Filter resources according to the selector and return it!
        return callback(null, self.aws.filterResources(list, selector));
    });

};


// Get a list of EC2 instances by their instance ID's
exports.getInstancesById = function(region, ids, opts, callback) {

    var
        self = this,
        ec2,
        params = {};

    // Get module set up for the requested region
    ec2 = self.aws.getRegionModule(region, 'EC2');

    // Build the parameters
    Object.keys(opts).forEach(function(optName){
        if ( optName.match(/^[A-Z]/) )
            params[optName] = opts[optName];
    });

    // Ignore non i- ids, otherwise we'll get in trouble querying generic stuff by name
    ids = ids.filter(function(id){ return id.match(/^i-/) });

    if ( ids.length > 0 )
        params.InstanceIds = ids;

    // Describe autoscaling groups
    return ec2.describeInstances(params, function(err, answer) {
        if ( err ) {
            console.log("Error getting ec2 instances by id ("+JSON.stringify(ids)+"): ", err);
            return callback(err,null);
        }

        var list = [];
        answer.Reservations.forEach(function(reserv){
            if ( !reserv.Instances )
                return;
            reserv.Instances.forEach(function(inst){
                // Convert instance tags
                inst.Tags = _convertInstTags(inst.Tags);

                // Add to the list
                list.push(inst);
            });
        });

//        var list = [{"InstanceId":"i-55d335c3","ImageId":"ami-9398d3e0","State":{"Code":16,"Name":"running"},"PrivateDnsName":"ip-172-31-46-192.eu-west-1.compute.internal","PublicDnsName":"ec2-54-229-107-117.eu-west-1.compute.amazonaws.com","StateTransitionReason":"","KeyName":"Keypair1","AmiLaunchIndex":0,"ProductCodes":[],"InstanceType":"t2.nano","LaunchTime":"2016-11-11T14:54:53.000Z","Placement":{"AvailabilityZone":"eu-west-1c","GroupName":"","Tenancy":"default"},"Monitoring":{"State":"disabled"},"SubnetId":"subnet-39b21660","VpcId":"vpc-15d27c70","PrivateIpAddress":"172.31.46.192","PublicIpAddress":"54.229.107.117","Architecture":"x86_64","RootDeviceType":"ebs","RootDeviceName":"/dev/xvda","BlockDeviceMappings":[{"DeviceName":"/dev/xvda","Ebs":{"VolumeId":"vol-d4629764","Status":"attached","AttachTime":"2016-11-11T14:54:54.000Z","DeleteOnTermination":true}}],"VirtualizationType":"hvm","ClientToken":"yWNZU1478876093258","Tags":{"OneTag":"OneValue","Project":"Jacquard","TwoTags":"TwoValues"},"SecurityGroups":[{"GroupName":"launch-wizard-8","GroupId":"sg-874ae5e1"}],"SourceDestCheck":true,"Hypervisor":"xen","NetworkInterfaces":[{"NetworkInterfaceId":"eni-58010206","SubnetId":"subnet-39b21660","VpcId":"vpc-15d27c70","Description":"","OwnerId":"881829141866","Status":"in-use","MacAddress":"0a:bc:e0:ba:4b:ad","PrivateIpAddress":"172.31.46.192","PrivateDnsName":"ip-172-31-46-192.eu-west-1.compute.internal","SourceDestCheck":true,"Groups":[{"GroupName":"launch-wizard-8","GroupId":"sg-874ae5e1"}],"Attachment":{"AttachmentId":"eni-attach-545d37ea","DeviceIndex":0,"Status":"attached","AttachTime":"2016-11-11T14:54:53.000Z","DeleteOnTermination":true},"Association":{"PublicIp":"54.229.107.117","PublicDnsName":"ec2-54-229-107-117.eu-west-1.compute.amazonaws.com","IpOwnerId":"amazon"},"PrivateIpAddresses":[{"PrivateIpAddress":"172.31.46.192","PrivateDnsName":"ip-172-31-46-192.eu-west-1.compute.internal","Primary":true,"Association":{"PublicIp":"54.229.107.117","PublicDnsName":"ec2-54-229-107-117.eu-west-1.compute.amazonaws.com","IpOwnerId":"amazon"}}]}],"EbsOptimized":false,"EnaSupport":true}];

        return callback(null, self.aws.blessResources("EC2", "InstanceId", region, {}, list));
    });

};

function _convertInstTags(tags) {

    var
        tagHash = {};

    tags.forEach(function(t){
        tagHash[t.Key] = t.Value;
    });

    return tagHash;

}