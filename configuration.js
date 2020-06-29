const Libp2p = require('libp2p');
const { String } = require('ipfs-utils/src/globalthis');
const fs = require('fs');
const toml = require('toml');
const chalk = require('chalk');

// TODO:  
// 1.  watch the config file and notify listeners when it changes
// 2.  provide a method for registgering a listener
// 3.  Generalize this so it can work in the browser where there won't be a disk file

let Configuraton = /** @class */ (() => {
    class Configuraton {
        /**
         * @param {string} retrievalClientDataDirAbsPath Directory containing config.json
         * @constructor
         */
        constructor(retrievalClientDataDirAbsPath) {
            const rcDataDir = retrievalClientDataDirAbsPath
            const configFileName = 'config.toml'
 
            /**
             * configuration key/value value store
             *
             * @type {Map<string, Object}
             */
            this.configMap = new Map()
            this.configFileRead(retrievalClientDataDirAbsPath + '/' + configFileName)
            //this.debugPrintConfig()
        }

        /**
         * Sets this.configMap from config file, relying on Defaults where necessary
         * @param {string} configFileAbsPath Absolute path to config file
         */
        configFileRead(configFileAbsPath) {
          var configToml = fs.readFileSync(configFileAbsPath,'utf8')
          var fileConfigSettings = {}
          try {
            fileConfigSettings = toml.parse(configToml);
          } catch (e) {
            console.error('Parse error: ' + configFileAbsPath + ': line ' + e.line + ':' + e.column +
              ': ' + e.message);
          }
          const config = Object.assign(Configuraton.Defaults, fileConfigSettings)
          this.configMap.clear()
          for (const [key, value] of Object.entries(config)) {
            this.configMap.set(key,value)
          }
        }

        /**
         * Gets the config for a CID, returning the wildcard entry otherwise.
         * @param {string} cidStr The cid to search for
         * @return {Object} Object with the config settings that apply to cid.
         */
        getCidConfig(cidStr) {
            var ret = undefined
            var wildcard = undefined
            const cids = this.configMap.get('cids')
            for (const [key, value] of Object.entries(cids)) {
                if (value['cid']==cidStr) {
                    ret = Object.assign(value)
                    break
                } else if (value['cid']=='*') {
                    wildcard = Object.assign(value)
                }
            }
            ret = ret || wildcard
            return ret
        }
        
        /**
         * Dump this.configMap to the console
         */
        debugPrintConfig() {
            console.log("current config map:")
            this._dumpIterableObject(this.configMap,'  ')
        }

        /**
         * Dump an iterable object (like Map<>) to console
         */
        _dumpIterableObject(o,indentation) {
            indentation = indentation || ''
            for (let [key, value] of o) {
                if (value instanceof Array) {
                    var i = 0
                    for (let el of value) {
                        if (typeof el == "object") {
                            console.log(indentation+chalk.green(key+'['+i+']'))
                            this._dumpObject(el, indentation+'  ')
                        } else {
                            console.log(indentation+chalk.green(`'${key}[`+i+`]':'${el}'`))
                        }
                        i++
                    }
                } else {
                    console.log(indentation + chalk.green(`'${key}':'${value.toString()}'`))
                }
            }
        }
        /**
         * Dump any Object type to console
         */
        _dumpObject(o,indentation) {
            const isIterable = (typeof o[Symbol.iterator] === 'function')
            if (isIterable) {
                this._dumpIterableObject(o,indentation)
            } else {
                indentation = indentation || ''
                for (const [key, value] of Object.entries(o)) {
                    //if (typeof value == "object") {
                    console.log(indentation+chalk.green(`'${key}':'${value.toString()}'`))
                }
            }
        }          
    }

    /**
     * Default values for config keys
     *
     * @type {Object}
     */
    Configuraton.Defaults = {
        "lotusUrl":"http://127.0.0.1:1234/",
        "dataDir":"~/.retrieval_client_data",
        "cidDefaultPricePerByte":"0.0000000001",
        "cids": [
            {
                "cid":"*",
                "pricePerByte":0.0000000001
            },
        ],
    }

    return Configuraton;
})();
module.exports = Configuraton;
