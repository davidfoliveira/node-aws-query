"use strict";

var
    regionHandlers  = { };


exports.importHistory = function(region, metricPath, callback) {

    var
        self    = this,
        minutes = 7200,
        now     = new Date(),
        before  = new Date(now.getTime()-minutes*1000);

    // Get the metrics
    return self.getMetrics(region, metricPath, 60, before, now, callback);

};

exports.getLive = function(region, metricPath, callback) {

    var
        self    = this,
        minutes = 2,
        now     = new Date(),
        before  = new Date(now.getTime()-minutes*1000);

    // Get the metrics
    return self.getMetrics(region, metricPath, 60, before, now, callback);

};

exports.getMetrics = function(region, metricPath, period, from, to, callback) {

    var
        cloudwatch,
        params;

    // Set the parameters
    params = {
        EndTime:    to,
        MetricName: null,
        Namespace:  null,
        Period:     period || 60,
        StartTime:  from,
        Statistics: [ ],
        Dimensions: [
            {
                Name: null,
                Value: null
            }
        ],
        Unit: 'Count'
    };

    // Parse the metric path
    if ( !metricPath.match(/^([^\.]+)\.([^\.]+)\.([^\.]+)\.([^\.]+)\.([^\.]+)\(([^)]+)\)$/) )
        return callback(new Error("Invalid metric path"), null);

    params.Namespace = RegExp.$1;
    params.Dimensions[0].Name  = RegExp.$2;
    params.Dimensions[0].Value = RegExp.$3;
    params.MetricName = RegExp.$4;
    params.Statistics = [RegExp.$5];
    params.Unit = RegExp.$6;

    // Get CW handler for the requested region
    if ( !regionHandlers[region] ) {
        AWS.config.region = region;
        regionHandlers[region] = new AWS.CloudWatch();
    }
    cloudwatch = regionHandlers[region];

    // Call CW
    return cloudwatch.getMetricStatistics(params, function(err, data) {
        if ( err ) {
            console.log("Error getting cloudwatch history metrics: ", err);
            return callback(err,null);
        }

        // Set the value
        data.Datapoints.forEach(function(sample){
            sample.Value = sample[params.Statistics[0]];
        });

        // Return
        return callback(null, data.Datapoints.sort(function(a,b){
            return  (a.Timestamp > b.Timestamp) ? 1 :
                    (b.Timestamp > a.Timestamp) ? -1 :
                    0;
        }));
    });

}