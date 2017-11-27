#!/usr/bin/env node
const Configuration = require( './cfig' )
        , parseArgs = require( './cmdline' ).parseArgs
        , fs = require( 'fs' )
        , assert = require( 'assert' )
        , path = require( 'path' )
        , util = require( 'util' )
        , domain = require( 'domain' )
        , Joi = require( 'joi' )
        ;

const cleanupDirs = [ ];
const cleanupFiles = [ ];
function cleanup() {
    cleanupFiles.forEach( ( file ) => {
        fs.unlinkSync( file );
    } );
    cleanupDirs.forEach( ( dir ) => {
        fs.rmdirSync( dir );
    } );
}

function mkdir( dir ) {
    fs.mkdirSync( dir );
    cleanupDirs.push( dir );
}

function writeFile( file, data ) {
    if (typeof data !== 'string') {
        data = JSON.stringify( data );
    }
    fs.writeFileSync( file, data, {encoding: 'utf8'} );
    cleanupFiles.push( file );
}

function start( onstart, reqs ) {
    const http = require( 'http' );
    var server = http.createServer( ( req, res ) => {
        res.writeHead( 200, {
            'Content-Type': 'text/plain; charset=UTF-8'
        } );
        reqs.push( req );
        res.end( JSON.stringify( {http: true, thing: 'whatever', whee: 23, boo: 54} ) );
    } ).listen( 7638, "127.0.0.1", () => {
        onstart();
    } );
    return ( cb ) => {
        server.close( cb );
    };
}

function testHttp() {
    const reqs = [ ];
    var stop;
    var sdata = null;
    stop = start( () => {
        new Configuration( [ 'http://127.0.0.1:7638' ], {boo: 58, wug: 40}, function ( err, dta ) {
            if (err) {
                throw err;
            }
            sdata = dta;
            assert( reqs.length > 0 );
            assert( sdata );
            assert( sdata.http );
            assert.equal( sdata.thing, 'whatever', 'Whatever not set' );
            assert.equal( sdata.whee, 23, 'whee wrong value' );
            assert.equal( sdata.boo, 54, 'boo wrong value' );
            assert.equal( sdata.wug, 40, 'wug wrong value' );
            stop( () => {
            } );
        } );
    }, reqs );
}

const fixture1 = {foo: 'whee', fromOne: true};
const fixture2 = {foo: 'moo', fromTwo: true};
const fixture3 = {foo: 'whatzit', fromThree: true, wug: null};
const fixture4 = {foo: 'bar', skiddoo: 23};
const fixture5 = {foo: 'bar', skiddoo: 'hello'};
const now = '' + new Date().getTime();
const tmp = require( 'os' ).tmpdir();
const dir1 = path.join( tmp, 'configTest_' + now + '_1' );
const dir2 = path.join( tmp, 'configTest_' + now + '_2' );
const dir3 = path.join( tmp, 'configTest_' + now + '_3' );
const dir4 = path.join( tmp, 'configTest_' + now + '_4' );
const dir5 = path.join( tmp, 'configTest_' + now + '_5' );
const file1 = path.join( dir1, 'test.json' );
const file2 = path.join( dir2, 'test.json' );
const file3 = path.join( dir3, 'test.json' );
const file4 = path.join( dir4, 'test.json' );
const file5 = path.join( dir5, 'test.json' );
var setup = false;

function setupFiles() {
    mkdir( dir1 );
    mkdir( dir2 );
    mkdir( dir3 );
    mkdir( dir4 );
    mkdir( dir5 );

    writeFile( file1, fixture1 );
    writeFile( file2, fixture2 );
    writeFile( file3, fixture3 );
    writeFile( file4, fixture4 );
    writeFile( file5, fixture5 );
}
setupFiles();

function testCfig() {
    var ds = {foo: 'bar', baz: 23, wug: 'moo'};
    var wasRun = false;
    new Configuration( ds, function ( err, dta ) {
        assert.ifError( err );
        assert.equal( dta.baz, 23 );
        assert.equal( dta.foo, 'whatzit', "Should be whatzit is " + dta.foo );
        assert.equal( dta.fromOne, true );
        assert.equal( dta.fromTwo, true );
        assert.equal( dta.fromThree, true );
        assert.equal( dta.wug, 'moo' );
        wasRun = true;
    }, [ dir1, dir2, dir3 ] );

    setTimeout( function () {
        assert.equal( true, wasRun );
        wasRun = false;
        Configuration.addExpansions( {f: 'foo'} );
        Configuration.addExpansions( {q: 'quux'} );
        assert.deepEqual( Configuration.expansions, {f: 'foo', q: 'quux'} );
        new Configuration.addExpansions( {b: 'brr'} )( function ( err, cfig ) {
            assert.ifError( err );
            assert.deepEqual( Configuration.expansions, {f: 'foo', q: 'quux', b: 'brr'} );
            wasRun = true;
        } );
        setTimeout( function () {
            assert.equal( wasRun, true, "Code was not run" );

            process.argv = [ 'node', 'foo', '-fp', '--mub', 'bar', 'quux', '-b', 'monkey', 'woob', '--hey.you', '23' ];
            new Configuration( {foo: 35}, function ( err, cfig ) {
                assert.ifError( err );
                delete cfig.reload;
                assert.deepEqual( cfig, {foo: true,
                    p: true,
                    mub: 'bar',
                    quux: true,
                    brr: 'monkey',
                    hey: {you: 23},
                    woob: true} );

                const defaults = {
                    queue: {
                        prefix: 'bq',
                        stallInterval: 15000,
                        redis: {
                            host: '127.0.0.1',
                            port: 6379,
                            db: 0,
                            options: {}
                        },
                        getEvents: false,
                        sendEvents: true,
                        isWorker: false,
                        removeOnSuccess: true,
                        catchExceptions: false
                    },
                    test: false
                };
                Configuration.args = [ '--queue.redis.port', '3207', '-r', 'redis.foo.com' ];
                Configuration.addExpansions( {r: 'queue.redis.host'} );
                new Configuration( defaults, [ ], function ( err, info ) {
                    assert.ifError( err );
                    assert.deepEqual( info.queue.redis, {host: 'redis.foo.com', port: 3207, db: 0, options: {}} );
                } );
            } );
        }, 100 );
    }, 100 );
}

function testCmdline() {
    var x = parseArgs();
    assert.deepEqual( x, {} );
    var args = [ "--foo", "monkey", "-b", "whatzit", "--poodle", "hoover" ];

    var expansions = {
        f: 'foo',
        b: 'bugle',
        p: 'poodle'
    };

    var x = parseArgs( expansions, args );

    var expect = {
        foo: 'monkey',
        bugle: 'whatzit',
        poodle: 'hoover'
    };

    assert.deepEqual( x, expect );

    args = [ '-f', '-p', '--bugle', 'hoo', 'hah' ];
    expect = {
        foo: true,
        bugle: 'hoo',
        poodle: true,
        hah: true
    };
    x = parseArgs( expansions, args );
    assert.deepEqual( x, expect );

    args = [ '-fpb' ];
    expect = {
        foo: true,
        bugle: true,
        poodle: true
    };
    x = parseArgs( expansions, args );
    assert.deepEqual( x, expect );

    args = [ '-fpbqdz' ];
    expect = {
        foo: true,
        bugle: true,
        poodle: true,
        q: true,
        d: true,
        z: true
    };
    x = parseArgs( expansions, args );
    assert.deepEqual( x, expect );

    x = parseArgs( null, [ 'food', 'bug', 'monkey', 'food', 'stew', '--foo', 'bar' ] );

    assert.deepEqual( x, {food: true,
        bug: true,
        monkey: true,
        stew: true,
        foo: 'bar'} );

    x = parseArgs( null, [ 'foo', 'bar.baz', 'woo.hoo.you' ] );
    expect = {
        foo: true, bar: {baz: true}, woo: {hoo: {you: true}}};


    x = parseArgs( null, [ '--skiddoo', '23', '--the.meaning', '42', '--i.think.its', 'true', '--but.that.is', 'false', '--but.that.will', 'do' ] );
    expect = {skiddoo: 23,
        the: {meaning: 42},
        i: {think: {its: true}},
        but: {that: {is: false, will: 'do'}}};

    assert.deepEqual( x, expect );
}

function testJoi() {
    const schema = Joi.object().keys( {
        foo: Joi.string().min( 3 ).max( 3 ).regex( /^b.*/ ),
        skiddoo: Joi.number().integer().min( 23 ),
        wunk: Joi.boolean()
    } );
    new Configuration( {wunk: true, skiddoo: 24}, schema, [ dir4 ], function ( err, data ) {
        assert.ifError( err );
        assert( data.wunk );
        assert( data.foo );
        assert( data.skiddoo );
    } );
    new Configuration( {wunk: true}, schema, [ dir5 ], function ( err, data ) {
        assert( util.isError( err ) );
    } );
    new Configuration( schema, [ dir5 ], function ( err, data ) {
        assert( util.isError( err ) );
    } );
    new Configuration( {wunk: true, skiddoo: 11}, schema, [ dir5 ], function ( err, data ) {
        assert( util.isError( err ) );
    } );
}

function testWithExpansionsAndArgs() {
    var x = Configuration.withExpansions( {m: 'moo'}, [ '-m', 'monkey' ] )( {moo: 'whatzit'}, [ dir4 ], function ( err, data ) {
        assert.ifError( err );
        assert( data );
        assert.equal( data.moo, 'monkey' );
    } );
}

function testChild() {
    var x = Configuration.withExpansions( {m: 'moo'}, [ '-m', 'monkey' ] )( {moo: 'whatzit'}, [ dir4 ], function ( err, data ) {
        assert.ifError( err );
        assert( data );
        assert.equal( data.moo, 'monkey' );
    } );
    var y = x.child( 'wookie' )( {wunk: 'bean'}, [ dir5 ], function ( err, data ) {
        assert.ifError( err );
        assert.deepEqual( data, {moo: 'monkey',
            foo: 'bar',
            skiddoo: 23,
            wookie: {wunk: 'bean', foo: 'bar', skiddoo: 'hello'}} )
    } );
}

function testEnvWrapper() {
    process.env['woo.wumble'] = 'moog';
    process.env['gugu'] = '13';
    process.env['whoo'] = 'TRUE';
    process.env['whug'] = 'TRUTHY';
    var defs = {'HOME': '/foober', whoo: false, whug: false, boozle: 'racket', gugu: 57, woo: {wumble: 'toes'}};
    var res = Configuration.withEnvironment( defs, [ dir4 ], function ( err, edata ) {
        assert.notEqual( defs.HOME, edata.HOME );
        var e;
        try {
            edata.HOME = 'heya';
        } catch ( err ) {
            e = err;
        }
        if (typeof e === 'undefined') {
            throw new Error( "Should have thrown an error" );
        }
        assert.equal( "bar", edata.foo );
        assert.equal( 23, edata.skiddoo );
        assert.equal( 'moog', edata.woo.wumble );
        assert( typeof edata['gugu'] === 'number' );
        assert.equal( 13, edata.gugu );
        assert( typeof edata.whug === 'string' );
        assert.equal( 'TRUTHY', edata.whug );
        assert( typeof edata.whoo === 'boolean' );
        assert( edata.whoo === true );
    } );
}

function testEnvWrapperWithExpansions() {
    var defs = {'HOME': '/goober', boozle: 'racket'};
    var res = Configuration.withEnvironmentAndExpansions( {h: 'HOME', m: 'moo'}, [ '-m', 'marsupial', '-h', '/tuber' ] )( defs, [ dir4 ], function ( err, edata ) {
        assert.notEqual( defs.HOME, edata.HOME );
        assert.notEqual( '/tuber', edata.HOME );
        var e;
        try {
            edata.HOME = 'hoog';
        } catch ( err ) {
            e = err;
        }
        if (typeof e === 'undefined') {
            throw new Error( "Should have thrown an error" );
        }
        assert.equal( "bar", edata.foo );
        assert.equal( 23, edata.skiddoo );
        assert.equal( 'marsupial', edata.moo );
    } );
}

function testSetEnv() {
    process.env['_wiggle'] = 'foob';
    assert.equal( 'foob', process.env['_wiggle'] );
}

var failures = [ ];
process.on( 'uncaughtException', ( err ) => {
    console.error( err );
    process.exit( 1 );
} );
process.on( 'exit', () => {
    try {
        cleanup();
    } catch ( err ) {
        failures.push( {name: 'cleanup', err: err} );
    }
    if (failures.length > 0) {
        for (var i = 0; i < failures.length; i++) {
            var failed = failures[ i ];
            console.log( failed.name + ' failed', failed.err.stack );
            console.log( '\n' );
        }
        process.exit( 1 );
    }
    console.log( 'Success.' );
} );

function oneTest( test ) {
    const d = domain.create();
    d.on( 'error', function ( err ) {
        console.error( 'ERROR ' + test.name );
        failures.push( {name: test.name, err: err} );
    } );
    d.run( test );
}

function runTests() {
    for (var i = 0; i < arguments.length; i++) {
        assert( "not a function : " + util.inspect( arguments[i] ), typeof arguments[i] === 'function' );
        oneTest( arguments[i] );
    }
}

runTests(
        testCfig,
        testCmdline,
        testHttp,
        testJoi,
        testWithExpansionsAndArgs,
        testChild,
        testSetEnv,
        testEnvWrapper,
        testEnvWrapperWithExpansions
        );
