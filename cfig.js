/*
 The MIT License (MIT)
 
 Copyright (c) 2014 Tim Boudreau
 
 Permission is hereby granted, free of charge, to any person obtaining a copy of
 this software and associated documentation files (the "Software"), to deal in
 the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:
 
 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.
 
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
const path = require( 'path' ), hoek = require( 'hoek' ), fs = require( 'fs' ),
        util = require( 'util' ), cmdline = require( './cmdline' ),
        Joi = require( 'joi' ), EnvWrapper = require( './env-wrapper' );

function getUserHome() {
    return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'] || '~/';
}

const context = {};

function Configuration() {
    var self = {};
    var dirs = null;
    var name = null;
    var defaults = null;
    var callback = null;
    var log = false;
    var schema = null;
    var exp = context.expansions;
    var cargs = context.args;

    for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] === 'undefined') {
            continue;
        } else if (util.isArray( arguments[i] )) {
            if (dirs) {
                throw new Error( "More than one array argument passed" );
            }
            dirs = arguments[i];
        } else if (typeof arguments[i] === 'string') {
            if (name) {
                throw new Error( "More than one string argument passed" );
            }
            name = arguments[i];
        } else if (typeof arguments[i] === 'object' && !Array.isArray( arguments[i] ) && arguments[i].isJoi) {
            if (schema) {
                throw new Error( "More than one Joi schema argument passed" );
            }
            schema = arguments[i];
        } else if (typeof arguments[i] === 'object' && !Array.isArray( arguments[i] ) && !arguments[i].isJoi) {
            if (defaults) {
                throw new Error( "More than one object argument passed" );
            }
            defaults = arguments[i];
        } else if (typeof arguments[i] === 'function' && !arguments[i].isJoi) {
            if (callback) {
                throw new Error( "More than one function argument passed" );
            }
            callback = arguments[i];
        } else if (typeof arguments[i] === 'boolean') {
            if (log) {
                throw new Error( "More than one boolean argument passed" );
            }
            log = arguments[i];
        }
    }
    dirs = dirs || [ '/etc', '/opt/local/etc', getUserHome(), './', '/etc/cfig' ];
    defaults = defaults || {};
    if (!name) {
        name = path.basename( require.main.filename, '.js' );
    }
    var fn = name + '.json';

    function httpFetch( url, base, cb ) {
        var client = require( './minimal-http-client' );
        if (log) {
            console.log( 'Download settings from ' + url );
        }
        client( url, headers[url], function ( err, data ) {
            if (err) {
                return cb( err );
            }
            try {
                data = JSON.parse( data );
                if (log) {
                    console.log( 'Downloaded ' + url, data );
                }
            } catch ( err2 ) {
                return cb( err2 );
            }
            var res = hoek.applyToDefaults( base, data );
            cb( null, res );
        } );
    }

    const urlTest = /^http[s]?:\/\/.*?/;
    function readOne( dir, base, cb ) {
        if (urlTest.test( dir )) {
            return httpFetch( dir, base, cb );
        }
        var fl = path.join( dir, fn );
        if (log) {
            console.log( 'Read settings from ' + fl );
        }
        fs.exists( fl, function ( exists ) {
            if (exists) {
                fs.readFile( fl, 'utf8', function ( err, data ) {
                    if (err) {
                        return cb( err );
                    }
                    var obj;
                    try {
                        obj = JSON.parse( data );
                    } catch ( err ) {
                        console.error( 'Bad json in ' + fl, err.message );
                        cb( err, data );
                    }
                    if (log) {
                        console.log( fl, obj );
                    }
                    var res = hoek.applyToDefaults( base, obj );
                    cb( null, res );
                } );
            } else {
                if (log) {
                    console.log( '...no such file ' + fl );
                }
                cb( null, base );
            }
        } );
    }

    function validate( obj ) {
        if (schema) {
            var err = Joi.validate( obj, schema, {allowUnknown: true, skipFunctions: true} ).error;
            if (err) {
                if (callback) {
                    callback( err );
                    return false;
                } else {
                    throw err;
                }
            }
        }
        return true;
    }

    const me = this;
    var arr = hoek.clone( dirs ).reverse();
    function go( err, data ) {
        if (err) {
            if (callback) {
                return callback( err );
            } else {
                throw err;
            }
        }
        if (arr.length === 0) {
            hoek.merge( self, data );
            var last = cmdline.parseArgs( exp || Configuration.expansions, cargs || Configuration.args || process.argv.slice( 2 ) );
            hoek.merge( self, last );
            hoek.merge( me, self ); // Compatibility
            if (validate( self )) {
                if (callback) {
                    callback( null, self );
                }
            }
        } else {
            var d = arr.pop();
            readOne( d, data, go );
        }
    }

    function reload( cb ) {
        callback = cb;
        go( null, hoek.clone( defaults ) );
    }
    this.reload = reload;
    reload( callback );

    this.child = function ( name, expansions, args ) {
        var createFunction = Configuration.withExpansions( expansions || {}, args );
        return function () {
            var fakeArgs = [ ];
            var callback = null;
            function localCallback( err, what ) {
                self[name] = what;
                callback( err, self );
            }
            for (var i = 0; i < arguments.length; i++) {
                if (typeof arguments[i] === 'function') {
                    callback = arguments[i];
                    fakeArgs.push( localCallback );
                } else {
                    fakeArgs.push( arguments[i] );
                }
            }
            if (callback === null) {
                throw new Error( "no callback passed" );
            }
            createFunction.apply( null, fakeArgs );
        };
    };
    return this;
}

module.exports = Configuration;

Configuration.withExpansions = function ( exps, args ) {
    if (typeof exps !== 'object') {
        throw new Error( "Not an object: " + util.inspect( exps ) );
    }
    return function () {
        context.expansions = exps;
        context.args = args;
        try {
            return Configuration.prototype.constructor.apply( null, arguments );
        } finally {
            delete context.expansions;
            delete context.args;
        }
    };
};

/**
 * Create a read-only configuration object passed to the callback, which allows
 * environment variables to override configuration values from files or defaults,
 * including in nested objects.
 */
Configuration.withEnvironment = function () {
    var newArgs = [ ];
    var callback = null;
    function cb( err, config ) {
        callback( err, new EnvWrapper( config ) );
    }
    for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] === 'function') {
            callback = arguments[i];
            newArgs.push( cb );
        } else {
            newArgs.push( arguments[i] );
        }
    }
    if (typeof callback !== 'function') {
        throw new Error( "No callback passed" );
    }
    return Configuration.prototype.constructor.apply( null, newArgs );
};

/**
 * Create a read-only configuration object passed to the callback, which allows
 * environment variables to override configuration values from files or defaults,
 * including in nested objects.  Returns a function which, when called with the
 * defaults, array of paths, callback, etc. will do the right thing.
 */
Configuration.withEnvironmentAndExpansions = function ( exps, args ) {
    return function () {
        var newArgs = [ ];
        var callback = null;
        function cb( err, config ) {
            callback( err, new EnvWrapper( config ) );
        }
        for (var i = 0; i < arguments.length; i++) {
            if (typeof arguments[i] === 'function') {
                callback = arguments[i];
                newArgs.push( cb );
            } else {
                newArgs.push( arguments[i] );
            }
        }
        if (typeof callback !== 'function') {
            throw new Error( "No callback passed" );
        }
        context.expansions = exps;
        context.args = args;
        try {
            return Configuration.prototype.constructor.apply( null, newArgs );
        } finally {
            delete context.expansions;
            delete context.args;
        }
    };
};

/**
 * Deprecated
 *
 * @param {type} exps
 * @return {nm$_cfig.Configuration}
 */
Configuration.addExpansions = function ( exps ) {
    if (typeof exps !== 'object') {
        throw new Error( "Not an object: " + util.inspect( exps ) );
    }
    if (Configuration.expansions) {
        Configuration.expansions = hoek.merge( exps, Configuration.expansions );
    } else {
        Configuration.expansions = exps;
    }
    return Configuration;
};

var headers = {};

Configuration.addHeaders = function ( url, hdrs ) {
    headers[url] = hdrs;
};
