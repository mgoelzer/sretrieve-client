const Libp2p = require('libp2p');
const { String } = require('ipfs-utils/src/globalthis');
const fs = require('fs');
const toml = require('toml');
const chalk = require('chalk');
const Configuraton = require('./configuration.js')

// 1.  Set a directory watch on dataDir so we know when it has changed

let LocalCids = /** @class */ (() => {
    class LocalCids {
        /**
         * @param {Configuration} config The toml config file object
         * @constructor
         */
        constructor(config) {
            /**
             * toml configuration key/value value store
             *
             * @type {Map<string, Object}
             */
            this.config = config

            this.debugPrintCids()
        }

        /**
         * Returns get(cid)!=undefined
         * @param {string} cid The cid caller is querying
         * @return {Boolean} Returns whether CID was found on disk
         */
        has(cid) {
            return (this.get(cid)!=undefined)
        }

        /**
         * Get the settings for a CID present on local disk
         * @param {string} cid The cid caller is querying
         * @return {Object} Returns an object with fields {.cidStr, .pricePerByte} if CID is found on disk; otherwise return undefined
         */
        get(cidStr) {
            const dataDir = this.config.configMap.get('dataDir')
            var cidsOnDisk = fs.readdirSync(dataDir)
            for (const f of cidsOnDisk) {
                if (f==cidStr) {
                    var localCid = {}
                    localCid.cidStr = cidStr
                    const cidConfig = this.config.getCidConfig(cidStr)
                    localCid.pricePerByte = cidConfig.pricePerByte
                    return localCid
                }
            }
            return undefined
        }

        /**
         * Dumps a list of all on-disk CIDs to the console
         */
        debugPrintCids() {
            const dataDir = this.config.configMap.get('dataDir')
            var cidsOnDisk = fs.readdirSync(dataDir)
            console.log(chalk.green('    Listing CIDs in local cache (' + dataDir + ')'))
            for (const f of cidsOnDisk) {
                var localCid = this.get(f)
                console.log('    ' + chalk.green(localCid['cidStr'] + ': {.pricePerByte' + localCid['pricePerByte'] + '}'))
            }
        }
    }

    return LocalCids;
})();
module.exports = LocalCids;

