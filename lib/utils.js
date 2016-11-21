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

// Get all property values
exports.getAllPropertyValues = function(o, p) {

    var
        values = [];

    this.iteratePropertyValues(o, p, function(v){
        values.push(v);
    });

    return values;

}


// Iterate over property values
exports.iteratePropertyValues = function(o, p, handler) {

    return _iteratePropertyValues(o, p, handler);

}

function _iteratePropertyValues(o, p, handler) {

    var
        parts = p.split("."),
        part,
        parent;

    // We have property components, we have to follow them
    while ( parts.length && (part = parts.shift()) != null ) {
        parent = o;
        o = o[part];
        if ( o instanceof Array ) {
            for ( var idx = 0 ; idx < o.length ; idx++ )
                _iterateArrayVal(o,idx,o[idx],parts.join("."),handler);
            continue;
        }
        if ( o == null || (parts.length && typeof(o) != "object") )
            return;
        if ( parts.length == 0 ) {
            var rv = handler(o);
            if ( rv != null )
                parent[part] = rv;
        }
    }

}

function _iterateArrayVal(o, idx, val, p, handler) {

    if ( p == "" ) {
        var rv = handler(val);
        if ( rv != null )
            o[idx] = rv;
    }
    else
        return _iteratePropertyValues(val, p, handler);

}