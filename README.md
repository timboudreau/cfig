cfig - Configuration Manager
============================

Yet another NodeJS JSON configuration loading + command-line argument parsing 
library.  Because the world needed another and I've written this code too many
times not to have it in a library.

The purpose is to provide a standard, straightforward way of reading configuration
from configuration files and command-line arguments, and encapsulating that 
information.

A Configuration object has a *name* - which is the name of JSON files it will
look for.  By default it looks for ``$NAME.json`` in ``/etc``, ``~/`` and ``./``
(but you can pass some other set of folders if you want).
It will read all of them if all are present, with later ones overriding 
earlier ones.

Then it looks at the command-line arguments (e.g. ``--port 8080`` or ``-p 8080``) 
and includes those, possibly overriding values from files.  You can supply 
expansions for single-letter command-line switches.

Usage
-----

In a file called ``myapp.js``:

```
        var Configuration = require( 'cfig' );

        var defaults = { foo : 'bar', baz : 42 }

        new Configuration( defaults, function(err, cfig) {

            // cfig now contains the defaults, overridden by values from
            // /etc/myapp.json, ~/myapp.json and ./myapp.json
            // overridden again by any command-line arguments in the form
            // --key value
        });
```

Constructor arguments to ``Configuration`` can be supplied in any order;  there
can be any, none or all of:

 * An array of strings - directories to look in for JSON files, instead of ``/opt/local/etc``, ``/etc/``, ``~/`` and ``./``
	* As of 1.1, a string may also be an HTTP or HTTPS url to download configuration from
 * An object (non-array javascript hash) containing default values
 * A string - the name for those JSON files - if not, it uses the basename of `require.main` - i.e. it will be `myapp.json` if
the main file is named `myapp.js`.
 * A boolean - if true, log the files it's reading as it reads them
 * A function - to call back once all files have been read
 * A [joi](https://github.com/hapijs/joi/) schema object for validation (since v1.4.0)

What It Does
------------

 * Loads configuration from JSON files and gives you back a Javascript object of them
 * By default, looks for ``$NAME.json`` in ``/etc``, ``~/`` and ``./`` - that is
    * System-wide configuration in ``/etc``
    * Per-user configuration in the current user home (if any)
    * Per-session configuration in the process working dir
    * Overrides any of those with command-line arguments
 * The file name is the file name of the file that launched the process, minus any ``.js``
    * Unless you pass a string argument to the Configuration constructor
 * Iterates all command-line arguments (``process.argv.slice(2)``) and processes them,
assuming a format ``--key value`` for long-form arguments.  ``Configuration.addExpansions()``
allows you to provide a hash of short (e.g. ``-k``) arguments and what long key names they
should map to.


Command-Line Arguments
----------------------

The process arguments are also taken into account.  Say you want to allow short-form
unix style arguments, which can be combined - i.e. ``-xvf`` is the same as ``-x -v -f``
is the same as ``--extract --verbose --file``:

```
        var expansions = {
            x: 'extract',
            v: 'verbose',
            f: 'file'
        }
        var defaults = { verbose : false }

        const Configuration = require('cfig').withExpansions(expansions);

        Configuration(defaults, function(err, cfig) {
        });
```

If you pass ``-xvf`` you get
```
    {
        extract : true,
        verbose : true,
        file : true
    }
```

You can also customize the arguments passed, rather than getting `process.argv.slice(2)` applied:

```
        const Configuration = require('cfig').withExpansions(expansions, ['-x', '-v']);

        Configuration(defaults, function(err, cfig) {
        });

```

## Dot Notation

Cfig supports *limited* dot-notation in command-line arguments - that is, passing
`--foo.bar` will get you `{ foo : { bar : true }}`, but passing array offsets, e.g.
`--foo.1` is not supported.

## Types

Command-line arguments are converted to booleans or numbers under the following conditions:

 * *number* - `/^\d+/` matches the value
 * *boolean* - the strings 'true' or 'false' match the value

Reloading
---------

``Configuration`` objects have one method:  ``reload(callback)``, which can be
used if you expect files on disk to be externally changed.

Note, this is a method on *the return value from calling `Configuration()`, **not**
the object with fields passed to the callback*.


What's New
----------

 * 2.0.0 - The object passed to the callback is *no longer the same object returned/created by Configuration()* - i.e.
`new Configuration (...)` returns a Configuration object with a `reload()` method;  the callback
you pass to `Configuration` is not what is passed to the callback.  The style of using `Configuration()` as
a constructor is deprecated, since it was possible to see the object *before all files were loaded and the
properties fully populated with their final values*.  **For the moment**, after load, the returned object
is populated with all of the same values once loading is complete.  This behavior will be removed in 3.x.

 * 2.0.0 - `Configuration.addExpansions()` is deprecated - this altered the behavior of Configuration globally
for all modules, which is a bad idea.  It's replacement, `withExpansions()` offers the same functionality plus
the ability to pass a second argument of command-line arguments (overriding use of `process.argv`) in one shot.

 * 2.0.0 - `Configuration.child(name, expansions, args)` - a method on the *Configuration object, not the key/value pair object passed
to the callback* allows you to load a second set of configuration files and defaults and have them appear as
a field of the original

 * 1.4.0 - Joi validation was added in 1.4.0, allowing a schema to be passed in for validation

 * 1.3.1 - Tests are moved to a new location
