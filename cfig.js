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
var path = require('path'), hoek = require('hoek'), fs = require('fs'),
        util = require('util'), cmdline = require('./cmdline');

function reverse(arr) {
    var result = [];
    for (var i = arr.length - 1; i >= 0; i--) {
        result.push(arr[i]);
    }
    return result;
}

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
        } else if (util.isArray(arguments[i])) {
            if (dirs) {
                throw new Error("More than one array argument passed");
            }
            dirs = arguments[i];
        } else if (typeof arguments[i] === 'string') {
            if (name) {
                throw new Error("More than one string argument passed");
            }
            name = arguments[i];
        } else if (typeof arguments[i] === 'object' && !util.isArray(arguments[i])) {
            if (defaults) {
                throw new Error("More than one object argument passed");
            }
            defaults = arguments[i];
        } else if (typeof arguments[i] === 'function') {
            if (callback) {
                throw new Error("More than one function argument passed");
            }
            callback = arguments[i];
        } else if (typeof arguments[i] === 'boolean') {
            if (log) {
                throw new Error("More than one boolean argument passed")
            }
            log = arguments[i];
        }
    }
    dirs = dirs || ['/etc', getUserHome(), './'];
    defaults = defaults || {};
    if (!name) {
        name = path.basename(require.main.filename, '.js');
    }
    var fn = name + '.json';

    function readOne(dir, base, cb) {
        var fl = path.join(dir, fn);
        if (log) {
            console.log('Read settings from ' + fl);
        }
        fs.exists(fl, function(exists) {
            if (exists) {
                fs.readFile(fl, 'utf8', function(err, data) {
                    if (err)
                        return cb(err);
                    try {
                        var obj = JSON.parse(data);
                        var res = hoek.applyToDefaults(base, obj);
                        cb(null, res);
                    } catch (err) {
                        cb(err, data);
                    }
                });
            } else {
                cb(null, base);
            }
        });
    }

    var arr = reverse(dirs);
    function go(err, data) {
        if (err) {
            if (callback) {
                return callback(err);
            } else
                throw err;
        }
        if (arr.length === 0) {
            for (var key in data) {
                self[key] = data[key];
            }
            var last = cmdline.parseArgs(Configuration.expansions);
            for (var key in last) {
                self[key] = last[key];
            }
            if (callback) {
                callback(null, self);
            }
        } else {
            var d = arr.pop();
            readOne(d, data, go);
        }
    }

    function reload(cb) {
        callback = cb;
        go(null, hoek.clone(defaults));
    }
    this.reload = reload;
    reload(callback)
}

module.exports = Configuration;

Configuration.addExpansions = function(exps) {
    if (typeof exps !== 'object') {
        throw new Error("Not an object: " + util.inspect(exps))
    }
    if (Configuration.expansions) {
        Configuration.expansions = hoek.merge(exps, Configuration.expansions);
    } else {
        Configuration.expansions = exps;
    }
    return Configuration;
}

//test
if (require.main === module) {
    try {
        var now = '' + new Date().getTime();
        var tmp = require('os').tmpdir();

        var dir1 = path.join(tmp, 'configTest_' + now + '_1');
        var dir2 = path.join(tmp, 'configTest_' + now + '_2');
        var dir3 = path.join(tmp, 'configTest_' + now + '_3');

        fs.mkdirSync(dir1)
        fs.mkdirSync(dir2)
        fs.mkdirSync(dir3)

        fs.writeFileSync(path.join(dir1, 'cfig.json'), JSON.stringify({foo: 'whee', fromOne: true}))
        fs.writeFileSync(path.join(dir2, 'cfig.json'), JSON.stringify({foo: 'moo', fromTwo: true}))
        fs.writeFileSync(path.join(dir3, 'cfig.json'), JSON.stringify({foo: 'whatzit', fromThree: true, wug: null}))

        var assert = require('assert')

        var ds = {foo: 'bar', baz: 23, wug: 'moo'}
        var wasRun = false;
        new Configuration(true, ds, function(err, dta) {
            assert.ifError(err);
            assert.equal(dta.baz, 23);
            assert.equal(dta.foo, 'whatzit', "Should be whatzit is " + dta.foo);
            assert.equal(dta.fromOne, true)
            assert.equal(dta.fromTwo, true)
            assert.equal(dta.fromThree, true)
            assert.equal(dta.wug, 'moo');
            wasRun = true;
        }, [dir1, dir2, dir3]);

        setTimeout(function() {
            assert.equal(true, wasRun)
            wasRun = false;
            Configuration.addExpansions({f: 'foo'})
            Configuration.addExpansions({q: 'quux'})
            assert.deepEqual(Configuration.expansions, {f: 'foo', q: 'quux'})
            new Configuration.addExpansions({b: 'brr'})(true, function(err, cfig) {
                assert.deepEqual(Configuration.expansions, {f: 'foo', q: 'quux', b: 'brr'})
                wasRun = true;
            });
            setTimeout(function() {
                assert.equal(wasRun, true, "Code was not run");

                process.argv = ['node', 'foo', '-fp', '--mub', 'bar', 'quux', '-b', 'monkey', 'woob'];
                new Configuration(true, { foo : 35 }, function(err, cfig) {
                    console.log('HEY!!')
                    console.log(util.inspect(cfig));
                    delete cfig.reload;
                    assert.deepEqual(cfig, {foo: true,
                        p: true,
                        mub: 'bar',
                        _last: 'woob',
                        quux: true,
                        brr: 'monkey',
                        woob: true});
                    console.log('Done.');
                });

            }, 100)
        }, 100)
    } catch (err) {
        console.log(err)
        process.exit(1)
    }
}
