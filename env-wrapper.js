

function EnvWrapper( config, prefix ) {
    var self = this;
    for (var key in config) {
        var ob = config[key];
        if (typeof ob === 'object' && !Array.isArray( ob )) {
            newNested( key, ob );
        } else {
            newGetterSetter( key );
        }
    }

    function newNested( key, ob ) {
        var k = typeof prefix === 'undefined' ? key : prefix + '.' + key;
        var res = new EnvWrapper( ob, k );
        self.__defineGetter__( key, function () {
            return res;
        } );
        self.__defineSetter__( key, function () {
            throw new Error( "Cannot set '" + k + "' - object is read-only" );
        } );
    }

    function newGetterSetter( key ) {
        var k = typeof prefix === 'undefined' ? key : prefix + '.' + key;
        self.__defineGetter__( key, function () {
            var res = process.env[k];
            if (typeof res !== 'undefined') {
                if (typeof config[key] === 'number') {
                    if (/^\d+\.\d+$/.test( res )) {
                        res = parseFloat( res );
                    } else if (/^\d+$/.test( res )) {
                        res = parseInt( res );
                    }
                } else if (typeof config[key] === 'boolean') {
                    if (res === '0' || res === 'false' || res === 'FALSE') {
                        res = false;
                    } else if (res === 'true' || res === '1' || res === 'TRUE') {
                        res = true;
                    }
                }
                return res;
            }
            return config[key];
        } );
        self.__defineSetter__( key, function () {
            throw new Error( "Cannot set '" + k + "' - object is read-only" );
        } );
    }
}

module.exports = EnvWrapper;
