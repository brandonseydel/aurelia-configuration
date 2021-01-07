import { WindowInfo } from './window-info';
import { PLATFORM } from 'aurelia';

export class Configuration<T extends Record<string, unknown> | { new(): T }> {
    #environment = 'default';
    #environments: string[] | null = null;
    #directory = 'config';
    #configFile = 'config.json';
    #cascadeMode = true;
    #bachPathMode = false;
    #window: WindowInfo;

    #configObject = {} as T;
    #configMergeObject = {} as T;

    constructor() {
        // Setup the window object with the current browser window information
        this.#window = new WindowInfo();
        this.#window.hostName = PLATFORM.location.hostname;
        this.#window.port = PLATFORM.location.port;

        // Only sets the pathname when its not '' or '/'
        if (PLATFORM.location.pathname && PLATFORM.location.pathname.length > 1) {
            this.#window.pathName = PLATFORM.location.pathname;
        }
    }


    /**
    * Set Directory
    *
    * Sets the location to look for the config file
    *
    * @param path
    */
    public set directory(value: string) {
        this.#directory = value;
    }

    /**
     * Set Config
     *
     * Sets the filename to look for in the defined directory
     *
     * @param name
     */
    public set configFile(value: string) {
        this.#configFile = value;
    }

    /**
     * Set Environment
     *
     * Changes the environment value
     *
     * @param environment
     */
    public set environment(environment: string) {
        this.#environment = environment;
    }

    /**
     * Set Environments
     *
     * Specify multiple environment domains to allow for
     * dynamic environment switching.
     *
     * @param environments
     */
    public set environments(environments: string[]) {
        if (environments !== null) {
            this.#environments = environments;

            // Check the hostname value and determine our environment
            this.check();
        }
    }

    /**
     * Set Cascade Mode
     *
     * By default if a environment config value is not found, it will
     * go looking up the config file to find it (a la inheritance style). Sometimes
     * you just want a config value from a specific environment and nowhere else
     * use this to disabled this functionality
     *
     * @param bool
     */
    public set cascadeMode(bool: boolean | undefined) {
        this.#cascadeMode = bool ?? true;
    }

    /**
     * Used to override default window information during contruction.
     * Should only be used during unit testing, no need to set it up in normal
     * operation
     *
     * @param bool
     */
    public set window(window: WindowInfo) {
        this.#window = window;
    }

    /**
     * Set Path Base Mode
     *
     * If you have several app on the same domain, you can emable base path mode to
     * use window.location.pathname to help determine your environment. This would
     * help a lot in scenarios where you have :
     * http://mydomain.com/dev/, http://mydomain.com/qa/, http://mydomain.com/prod/
     * That was you can have different config depending where your app is deployed.
     *
     * @param bool
     */
    public set basePathMode(bool: boolean | undefined | null) {
        this.#bachPathMode = !!bool;
    }

    /**
     * Get Config
     * Returns the entire configuration object pulled and parsed from file
     *
     * @returns {V}
     */
    get obj(): V {
        return this.#configObject;
    }

    /**
     * Get Config
     *
     * Get the config file name
     *
     * @returns {V}
     */
    get config(): V {
        return this.#configFile;
    }

    /**
     * Is
     *
     * A method for determining if the current environment
     * equals that of the supplied environment value*
     * @param environment
     * @returns {boolean}
     */
    public is(environment: string): boolean {
        return environment === this.#environment;
    }

    /**
     * Check
     * Looks for a match of the hostName to any of the domain
     * values specified during the configuration bootstrapping
     * phase of Aurelia.
     *
     */
    public check(): boolean {
        let hostname = this.#window.hostName;

        if (this.#window.port != '') {
            hostname += ':' + this.#window.port;
        }

        if (this.#bachPathMode) {
            hostname += this.#window.pathName;
        }

        // Check we have environments we can loop
        if (!this.#environments) { return; }

        // Loop over supplied environments
        for (const env in this.#environments) {
            // Get environment hostnames
            const hostnames = this.#environments[env];

            // Make sure we have hostnames
            if (!hostnames) {
                continue;

            }
            // Loop the hostnames
            for (const host of hostnames) {
                if (hostname.search('(?:^|W)' + host + '(?:$|W)') !== -1) {
                    this.environment = env;
                    // We have successfully found an environment, stop searching
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Environment Enabled
     * A handy method for determining if we are using the default
     * environment or have another specified like; staging
     *
     * @returns {boolean}
     */
    public get environmentEnabled(): boolean {
        return !(this.#environment === 'default' || this.#environment === '' || !this.#environment);
    }

    /**
     * Environment Exists
     * Checks if the environment section actually exists within
     * the configuration file or defaults to default
     *
     * @returns {boolean}
     */
    public get environmentExists(): boolean {
        return this.#environment in this.obj;
    }

    /**
     * GetDictValue
     * Gets a value from a dict in an arbitrary depth or throws
     * an error, if the key does not exist
     *
     * @param baseObject
     * @param key
     * @returns {*}
     */
    public getDictValue<T, K extends keyof T>(baseObject: T, key: K | string): unknown {
        key = key as string;
        const splitKey = key.split('.');
        let currentObject = baseObject;

        splitKey.forEach(key => {
            if (currentObject[key]) {
                currentObject = currentObject[key];
            } else {
                throw 'Key ' + key + ' not found';
            }
        });
        return currentObject;
    }

    /**
     * Get
     * Gets a configuration value from the main config object
     * with support for a default value if nothing found
     *
     * @param key
     * @param defaultValue
     * @returns {*}
     */
    get(key: string, defaultValue: any = null): any {
        // By default return the default value
        let returnVal = defaultValue;

        // Singular non-namespaced value
        if (key.indexOf('.') === -1) {
            // Using default environment
            if (!this.environmentEnabled) {
                return this.obj[key] ? this.obj[key] : defaultValue;
            }

            if (this.environmentEnabled) {
                // Value exists in environment
                if (this.environmentExists && this.obj[this.#environment][key]) {
                    returnVal = this.obj[this.#environment][key];
                    // Get default value from non-namespaced section if enabled
                } else if (this.#cascadeMode && this.obj[key]) {
                    returnVal = this.obj[key];
                }

                return returnVal;
            }
        } else {
            // nested key and environment is enabled
            if (this.environmentEnabled) {
                if (this.environmentExists) {
                    try {
                        return this.getDictValue(this.obj[this.#environment], key);
                    } catch {
                        // nested key, env exists, key is not in environment
                        if (this.#cascadeMode) {
                            try {
                                return this.getDictValue(this.obj, key);
                                // eslint-disable-next-line no-empty
                            } catch { }
                        }
                    }
                }
            } else {
                try {
                    return this.getDictValue(this.obj, key);
                    // eslint-disable-next-line no-empty
                } catch { }
            }
        }

        return returnVal;
    }

    /**
     * Set
     * Saves a config value temporarily
     *
     * @param key
     * @param val
     */
    public set(key: string, val: string) {
        if (key.indexOf('.') === -1) {
            this.obj[key] = val;
        } else {
            const splitKey = key.split('.');
            const parent = splitKey[0];
            const child = splitKey[1];

            if (this.obj[parent] === undefined) {
                this.obj[parent] = {};
            }

            this.obj[parent][child] = val;
        }
    }

    /**
     * Merge
     *
     * Allows you to merge in configuration options.
     * This method might be used to merge in server-loaded
     * configuration options with local ones.
     *
     * @param obj
     *
     */
    merge(obj: T) {
        const currentConfig = this.#configObject;

        this.#configObject = deepExtend(currentConfig, obj);
    }

    /**
     * Lazy Merge
     *
     * Allows you to merge in configuration options.
     * This method might be used to merge in server-loaded
     * configuration options with local ones. The merge
     * occurs after the config has been loaded.
     *
     * @param obj
     *
     */
    lazyMerge(obj: T) {
        const currentMergeConfig = this.#configMergeObject || {};

        this.#configMergeObject = deepExtend(currentMergeConfig, obj);
    }

    /**
     * Set All
     * Sets and overwrites the entire configuration object
     * used internally, but also can be used to set the configuration
     * from outside of the usual JSON loading logic.
     *
     * @param T
     */
    setAll(obj: T) {
        this.#configObject = obj;
    }

    /**
     * Get All
     * Returns all configuration options as an object
     *
     * @returns {T}
     */
    getAll(): T {
        return this.obj;
    }

    /**
     * Load Config
     * Loads the configuration file from specified location,
     * merges in any overrides, then returns a Promise.
     *
     * @returns {Promise}
     */
    loadConfig(): Promise<any> {
        return this.loadConfigFile(join(this.directory, this.config), (data: string) =>
            this.setAll(data),
        ).then(() => {
            if (this.#configMergeObject) {
                this.merge(this.#configMergeObject);
                this.#configMergeObject = null;
            }
        });
    }

    /**
     * Load Config File
     * Loads the configuration file from the specified location
     * and then returns a Promise.
     *
     * @returns {Promise}
     */
    loadConfigFile(path: string): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const pathClosure = path.toString();

            const xhr = new XMLHttpRequest();
            if (xhr.overrideMimeType) {
                xhr.overrideMimeType('application/json');
            }
            xhr.open('GET', pathClosure, true);

            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    const data = JSON.parse(this.responseText);
                    action(data);
                    resolve(data);
                }
            };

            xhr.onloadend = function () {
                if (xhr.status == 404) {
                    reject('Configuration file could not be found: ' + path);
                }
            };

            xhr.onerror = function () {
                reject(`Configuration file could not be found or loaded: ${pathClosure}`);
            };

            xhr.send(null);
        });
    }

    /**
     * Merge Config File
     *
     * Allows you to merge in configuration options from a file.
     * This method might be used to merge in server-loaded
     * configuration options with local ones.
     *
     * @param path      The path to the config file to load.
     * @param optional  When true, errors encountered while loading the config file will be ignored.
     *
     */
    async mergeConfigFile(path: string, optional: boolean): Promise<void> {
        try {
            const data = await this.loadConfigFile(path);
            this.lazyMerge(data);
        }
        catch {
            if (optional === true) {
                resolve();
            } else {
                reject(error);
            }
        }
    }
}
