"use strict";


// Parses a resource selector. It produces no results apart of a parsed selector object
// use getResources() to get the results of the parsed query object
exports.parseSelector = function(query) {

    var
        self = this,
        initialQuery = query,
        queryGroups = [],
        operConversion = {
            '':   'exists',
            '==': 'equals',
            '=':  'equals',
            '!=': 'not',
            '|=': 'equal_or_start+dash',
            '*=': 'contains',
            '~=': 'contains_word',
            '^=': 'starts_with',
            '$=': 'ends_with'
        };

    // While we do have a query
    while ( !query.match(/^\s*$/) ) {

        var
            expr = { };

        // Selector subject
        if ( query.match(/^\!\s*/) ) {
            expr.subject = true;
            query = query.replace(/^\!\s*/, "");
        }

        // A resource type
        if ( query.match(/^(\w+)/) ) {
            expr.type = RegExp.$1.toUpperCase();
            if ( !self._rscModules[expr.type] )
                throw new Error("Unsupported resource type: "+expr.type);
            query = query.replace(/^\w+/, "");
        }

        // A star selector (everything)
        if ( query.match(/^\*/) ) {
            expr.all = true;
            query = query.replace(/^\*/, "");
        }

        // A name or region
        while ( query.match(/^([#@])([\w\-]+)/) ) {
            var
                type = RegExp.$1,
                data = RegExp.$2;

            if ( type == "#" ) {
                if ( expr.name )
                    throw new Error("Filtering twice on name: "+query);
                expr.name = data;
            }
            else if ( type == "@" ) {
                if ( expr.region )
                    throw new Error("Filtering twice on region: "+query);
                expr.region = data;
            }
            else {
                if ( expr.tag == null )
                    expr.tag = [];
                expr.tag.push(data);
            }
            query = query.replace(/^([#@][\w\-]+)/, "");
        }

        // Tags/Attributes
        while ( query.match(/^\[(@?)([\w\-\.]+)\s*(?:([\|\*\~\$\!\^=]*=)\s*(?:\"([^"]*)\"|([^"][^\s\]]*)))?\s*\]/) ) {
            var
                isAttr      = RegExp.$1,
                name        = RegExp.$2,
                oper        = RegExp.$3,
                value       = RegExp.$4 || RegExp.$5;

            if ( !operConversion[oper] )
                throw new Error("Unknown operator: ", oper);
            if ( isAttr ) {
                if ( !expr.Attrs )
                    expr.Attrs = [];
                expr.Attrs.push({name: name, oper: oper, value: value});
            }
            else {
                if ( !expr.tags )
                    expr.tags = [];
                expr.tags.push({tag: name, oper: operConversion[oper], value: value });
            }
            query = query.replace(/^\[(@?[\w\-\.]+)\s*(?:[\|\*\~\$\!\^=]*=\s*(?:\"([^"]*)\"|([^"][^\s\]]*)))?\s*\]/, "");
        }

        // What?
        if ( Object.keys(expr).length == 0 )
            throw new Error("Unknown selector '"+query+"'");

        // Add the expression to the list
        queryGroups.push(expr);

        // What's the linking operator?

        // A direct child of
        if ( query.match(/^\s*>\s*/) ) {
            queryGroups.push({ link: 'direct-child' });
            query = query.replace(/^\s*>\s*/, "");
        }
        else if ( query.match(/^\s+./) ) {
            queryGroups.push({ link: 'all-descendants' });
            query = query.replace(/^\s+/, "");
        }

    }

    return { _selector: initialQuery, query: queryGroups };

}