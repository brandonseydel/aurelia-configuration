import { WindowInfo } from './window-info';
import { DI, IPlatform, PLATFORM } from 'aurelia';
import { join } from 'path';
import { deepExtend } from './deep-extend';

type Environments = Record<string, string[]> | null;
type ConfigurationRecord<T = Record<string, unknown>> = Record<string, unknown> | { new(): T };
export interface IConfiguration<T extends ConfigurationRecord<T> = ConfigurationRecord> {
    getDictValue<K extends keyof T>(baseObject: T, key: K | string): unknown;
    set(key: string, val: string): void;
    setAll(obj: T): void;
    loadConfig(): Promise<void>;
    check(): boolean;
    is(environment: string): boolean;
    lazyMerge(obj: T): void
    setBasePathMode(bool: boolean | undefined | null);
    readonly configObject: T;
    readonly configMergeObject: T;
    cascadeMode: boolean;
    directory: string;
    environment: string;
    configFile: string;
    environments: Environments;
    readonly environmentEnabled: boolean;
    get: (key: string, defaultValue?: unknown) => unknown;
}

export const IConfiguration = DI.createInterface<IConfiguration>('IConfiguration', x => x.singleton(Configuration));

export class Configuration<T extends ConfigurationRecord<T> = ConfigurationRecord> implements IConfiguration<T> {
    #environment = 'default';
    #environments: Environments = null;
    #directory = 'config';
    #configFile = 'config.json';
    #cascadeMode = true;
    #basePathMode = false;
    #windowInfo: WindowInfo;

    #configObject: T = {} as T;
    private _configMergeObject: T = {} as T;

    constructor(platform: IPlatform = PLATFORM) {
        // Setup the window object with the current browser window information
        this.#windowInfo = {
            hostName: platform.location.hostname,
            port: platform.location.port,
        } as WindowInfo;

        // Only sets the pathname when its not '' or '/'
        if (platform.location.pathname && platform.location.pathname.length > 1) {
            this.#windowInfo.pathName = platform.location.pathname;
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
   * Get Directory
   *
   * Gets the location to look for the config file
   *
   * @param path
   */
    public get directory(): string {
        return this.#directory;
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
     * Get Config
     *
     * Get the config file name
     *
     * @returns {string}
     */
    public get configFile(): string {
        return this.#configFile;
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
     * Get Environment
     *
     * Gets the environment value
     *
     * @param environment
     */
    public get environment(): string {
        return this.#environment;
    }

    /**
     * Set Environments
     *
     * Specify multiple environment domains to allow for
     * dynamic environment switching.
     *
     * @param environments
     */
    public set environments(environments: Environments) {
        if (environments !== null) {
            this.#environments = environments;

            // Check the hostname value and determine our environment
            this.check();
        }
    }

    /**
     * Get Environments
     *
     * Gets multiple environment domains
     *
     * @param environments
     */
    public get environments(): Environments {
        return this.#environments;
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

    public get cascadeMode(): boolean {
        return this.#cascadeMode;
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
    public setBasePathMode(bool: boolean | undefined | null): void {
        this.#basePathMode = !!bool;
    }

    /**
     * Get Config
     * Returns the entire configuration object pulled and parsed from file
     *
     * @returns {T}
     */
    get configObject(): T {
        return this.#configObject;
    }

    /**
     * Get Merge Config
     * Returns the entire configuration object pulled and parsed from file
     *
     * @returns {T}
     */
    get configMergeObject(): T {
        return this._configMergeObject;
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
        let hostname = this.#windowInfo.hostName;

        if (this.#windowInfo.port != '') {
            hostname += ':' + this.#windowInfo.port;
        }

        if (this.#basePathMode) {
            hostname += this.#windowInfo.pathName;
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
        return this.#environment in this.configObject;
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
    public get(key: string, defaultValue: unknown = null): unknown {
        // By default return the default value
        let returnVal = defaultValue;

        // Singular non-namespaced value
        if (key.indexOf('.') === -1) {
            // Using default environment
            if (!this.environmentEnabled) {
                return this.configObject[key] ? this.configObject[key] : defaultValue;
            }

            if (this.environmentEnabled) {
                // Value exists in environment
                if (this.environmentExists && this.configObject[this.#environment][key]) {
                    returnVal = this.configObject[this.#environment][key];
                    // Get default value from non-namespaced section if enabled
                } else if (this.#cascadeMode && this.configObject[key]) {
                    returnVal = this.configObject[key];
                }

                return returnVal;
            }
        } else {
            // nested key and environment is enabled
            if (this.environmentEnabled) {
                if (this.environmentExists) {
                    try {
                        return this.getDictValue(this.configObject[this.#environment], key);
                    } catch {
                        // nested key, env exists, key is not in environment
                        if (this.#cascadeMode) {
                            try {
                                return this.getDictValue(this.configObject, key);
                                // eslint-disable-next-line no-empty
                            } catch { }
                        }
                    }
                }
            } else {
                try {
                    return this.getDictValue(this.configObject, key);
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
    public set(key: string, val: string): void {
        if (key.indexOf('.') === -1) {
            this.configObject[key] = val;
        } else {
            const splitKey = key.split('.');
            const parent = splitKey[0];
            const child = splitKey[1];

            if (this.configObject[parent] === undefined) {
                this.configObject[parent] = {};
            }
            this.configObject[parent][child] = val;
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
    public merge(obj: T): void {
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
    public lazyMerge(obj: T): void {
        const currentMergeConfig = this._configMergeObject || {};
        this._configMergeObject = deepExtend(currentMergeConfig, obj);
    }

    /**
     * Set All
     * Sets and overwrites the entire configuration object
     * used internally, but also can be used to set the configuration
     * from outside of the usual JSON loading logic.
     *
     * @param T
     */
    public setAll(obj: T): void {
        this.#configObject = obj;
    }

    /**
     * Get All
     * Returns all configuration options as an object
     *
     * @returns {T}
     */
    public getAll(): T {
        return this.configObject;
    }

    /**
     * Load Config
     * Loads the configuration file from specified location,
     * merges in any overrides, then returns a Promise.
     *
     * @returns {Promise}
     */
    public async loadConfig(): Promise<void> {
        const data = await this.loadConfigFile(join(this.directory, this.configFile));
        this.setAll(data);
        if (this._configMergeObject) {
            this.merge(this._configMergeObject);
            this._configMergeObject = null;
        }
    }

    /**
     * Load Config File
     * Loads the configuration file from the specified location
     * and then returns a Promise.
     *
     * @returns {Promise}
     */
    public loadConfigFile(path: string): Promise<T> {
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
    public async mergeConfigFile(path: string, optional: boolean): Promise<void> {
        try {
            const data = await this.loadConfigFile(path);
            this.lazyMerge(data);
        }
        catch (e) {
            if (optional === true) {
                return
            } else {
                throw e
            }
        }
    }
}
