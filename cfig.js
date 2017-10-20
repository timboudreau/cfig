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
var path = require( 'path' ), hoek = require( 'hoek' ), fs = require( 'fs' ),
        util = require( 'util' ), cmdline = require( './cmdline' );

function getUserHome() {
    return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'] || '~/';
}

function Configuration() {
    var self = this;
    var dirs = null;
    var name = null;
    var defaults = null;
    var callback = null;
    var log = false;
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
        } else if (typeof arguments[i] === 'object' && !util.isArray( arguments[i] )) {
            if (defaults) {
                throw new Error( "More than one object argument passed" );
            }
            defaults = arguments[i];
        } else if (typeof arguments[i] === 'function') {
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
            console.log( 'APPLY ', data );
            var res = hoek.applyToDefaults( base, data );
            cb( null, res );
        } );
    }

    var urlTest = /^http[s]?:\/\/.*?/;
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
                    if (err)
                        return cb( err );
                    try {
                        var obj = JSON.parse( data );
                        if (log) {
                            console.log( fl, obj );
                        }
                        var res = hoek.applyToDefaults( base, obj );
                        cb( null, res );
                    } catch ( err ) {
                        console.error( 'Bad json in ' + fl, err.message );
                        cb( err, data );
                    }
                } );
            } else {
                console.log( '...no such file ' + fl );
                cb( null, base );
            }
        } );
    }

    var arr = hoek.clone( dirs ).reverse();
    function go( err, data ) {
        if (err) {
            if (callback) {
                return callback( err );
            } else
                throw err;
        }
        if (arr.length === 0) {
            for (var key in data) {
                self[key] = data[key];
            }
            var last = cmdline.parseArgs( Configuration.expansions, Configuration.args || process.argv.slice( 2 ) );
            hoek.merge( self, last );
            if (callback) {
                callback( null, self );
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
}

module.exports = Configuration;

Configuration.addExpansions = function ( exps ) {
    if (typeof exps !== 'object') {
        throw new Error( "Not an object: " + util.inspect( exps ) )
    }
    if (Configuration.expansions) {
        Configuration.expansions = hoek.merge( exps, Configuration.expansions );
    } else {
        Configuration.expansions = exps;
    }
    return Configuration;
}

var headers = {};

Configuration.addHeaders = function ( url, hdrs ) {
    headers[url] = hdrs;
}
