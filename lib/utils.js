"use strict";

// A leftpad that will never break!
exports.leftPad = function(num, strSize) {

    var
        len = num.toString().length;

    while ( len++ < strSize ) {
        num = "0" + num;
    }
    return num;

};

// The magic async if
exports.when = function(cond, cbTrue, cbAfter) {

	return cond ? cbTrue(cbAfter) : cbAfter();

};

// Get property value by name
exports.getPropertyValue = function(o,p) {

    var
        parts = p.split("."),
        part;

    while ( parts.length && (part = parts.shift()) != null ) {
        o = o[part];
        if ( o == null || (parts.length && typeof(o) != "object") )
            return null;
    }

    return o;

};