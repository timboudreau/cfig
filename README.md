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

        var Configuration = require( 'cfig' );

        var defaults = { foo : 'bar', baz : 42 }

        new Configuration( defaults, function(err, cfig) {

            // cfig now contains the defaults, overridden by values from
            // /etc/myapp.json, ~/myapp.json and ./myapp.json
            // overridden again by any command-line arguments in the form
            // --key value
        });

Constructor arguments to ``Configuration`` can be supplied in any order;  there
can be any, none or all of:

 * An array of strings - directories to look in for JSON files, instead of ``/opt/local/etc``, ``/etc/``, ``~/`` and ``./``
	* As of 1.1, a string may also be an HTTP or HTTPS url to download configuration from
 * An object (non-array javascript hash) containing default values
 * A string - the name for those JSON files
 * A boolean - if true, log the files it's reading as it reads them
 * A function - to call back once all files have been read

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

        var expansions = {
            x: 'extract',
            v: 'verbose',
            f: 'file'
        }
        var Configuration = require( 'cfig' ).addExpansions( expansions );

        var defaults = { verbose : false }

        new Configuration(defaults, function(err, cfig) {
            // Remember, if you use the configuration object before this
            // callback is called, it may not be fully initialized.
        });

If you pass ``-xvf`` you get

    {
        extract : true,
        verbose : true,
        file : true
    }

Reloading
---------

``Configuration`` objects have one method:  ``reload(callback)``, which can be
used if you expect files on disk to be externally changed.
