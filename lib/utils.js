"use strict";

exports.leftPad = function(num, strSize) {

    var
        len = num.toString().length;

    while ( len++ < strSize ) {
        num = "0" + num;
    }
    return num;

};

exports.when = function(cond, cbTrue, cbAfter) {

	return cond ? cbTrue(cbAfter) : cbAfter();

};
