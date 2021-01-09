import { WindowInfo } from './../src/window-info';
import { Configuration, IConfiguration } from '../src/aurelia-configuration';
import { BrowserPlatform } from '@aurelia/platform-browser';
import { PLATFORM } from 'aurelia';
import { JSDOM } from 'jsdom';

const jsdom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, { pretendToBeVisual: true });
const jsWindow: Window & typeof globalThis = Object.assign(jsdom.window as unknown as Window & typeof globalThis);

describe('Configuration class', () => {
    let configInstance: IConfiguration;

    beforeEach(() => {
        configInstance = new Configuration();
    });

    it('expect defaults to be set', () => {
        expect(configInstance.environment).toEqual('default');
        expect(configInstance.environments).toBeFalsy();
        expect(configInstance.directory).toEqual('config');
        expect(configInstance.configFile).toEqual('config.json');
        expect(configInstance.cascadeMode).toBeTruthy();
        expect(configInstance.configObject).toEqual({});
        expect(configInstance.configMergeObject).toEqual({});
    });

    it('set directory to non-default value', () => {
        configInstance.directory = 'configuration-files';
        expect(configInstance.directory).toEqual('configuration-files');
    });

    it('set config file name to non-default value', () => {
        configInstance.configFile = 'awesome-config-file.json';
        expect(configInstance.configFile).toEqual('awesome-config-file.json');
    });

    it('set environment to non-default value', () => {
        configInstance.environment = 'development';
        expect(configInstance.environment).toEqual('development');
    });

    it('set multiple environments', () => {
        const environments = {
            development: ['localhost', 'dev.local'],
            staging: ['staging.website.com', 'test.staging.website.com'],
            production: ['website.com'],
        };
        spyOn(configInstance, 'check');
        configInstance.environments = environments;

        expect(configInstance.environments).toEqual(environments);
        expect(configInstance.check).toHaveBeenCalled();
    });



    it('return config object', () => {
        expect(configInstance.configObject).toEqual({});
    });

    it('return config file', () => {
        expect(configInstance.configFile).toEqual('config.json');
    });

    it('is environment', () => {
        expect(configInstance.is('default')).toBeTruthy();
    });

    it('environment check function', () => {
        const environments = {
            development: ['localhost', 'dev.local'],
            staging: ['staging.website.com', 'test.staging.website.com'],
            production: ['website.com'],
        };

        configInstance.environments = environments;

        configInstance.check();

        //expect(configInstance.setEnvironment).toHaveBeenCalled();
    });

    it('works with the same url but different port', () => {
        const environments = {
            dev1: ['localhost'],
            dev2: ['localhost:9876'],
        };

        const platform = new BrowserPlatform(jsWindow, {
            location: {
                ...jsWindow.location,
                port: '9876',
                protocol: 'http:',
                hostname: 'localhost',
            }
        });
        configInstance = new Configuration(platform);
        configInstance.setAll({
            test: 'fallback',
            dev1: {
                test: 'dev1',
            },
            dev2: {
                test: 'dev2',
            },
        });

        configInstance.environments = environments;

        configInstance.check();
        const test = configInstance.get('test');
        expect(test).toEqual('dev2');
    });

    it('works with the different url but same ports', () => {
        const environments = {
            local: ['localhost:9000'],
            qa: ['www.qa.com:9000'],
            prod: ['www.prod.com:9000'],
        };
        const platform = new BrowserPlatform(jsWindow, {
            location: {
                ...jsWindow.location,
                port: '9000',
                protocol: 'http:',
                pathname: '/',
                hostname: 'localhost',
            }
        });

        const configuration = {
            test: 'fallback',
            local: {
                test: 'local',
            },
            qa: {
                test: 'qa',
            },
            prod: {
                test: 'prod',
            },
        };

        configInstance = new Configuration(platform);
        configInstance.setAll(configuration);
        configInstance.environments = environments;
        // Test to see if our local dev config works
        configInstance.check();
        const testLocal = configInstance.get('test');
        expect(testLocal).toEqual('local');

        // Test to see if our qa config works
        platform.location.hostname = 'www.qa.com';
        configInstance = new Configuration(platform);
        configInstance.setAll(configuration);
        configInstance.environments = environments;
        configInstance.check();
        const testQa = configInstance.get('test');
        expect(testQa).toEqual('qa');

        // Test to see if our prod config works
        platform.location.hostname = 'www.prod.com';
        configInstance = new Configuration(platform);
        configInstance.setAll(configuration);
        configInstance.environments = environments;
        Object.assign(configInstance, configInstance);

        configInstance.check();
        const testProd = configInstance.get('test');
        expect(testProd).toEqual('prod');
    });

    it('works with a base path', () => {
        const environments = {
            local: ['localhost'],
            qa: ['www.qa.com'],
            qaMaster: ['www.qa.com/master'],
            qaFeature1: ['www.qa.com/feature1'],
            qaFeature1SubFeature1: ['www.qa.com/feature1/subfeature1'],
            qaFeature1SubFeature2: ['www.qa.com/feature1/subfeature2'],
        };

        const platform = new BrowserPlatform(jsWindow, {
            location: {
                ...jsWindow.location,
                port: '',
                protocol: 'http:',
                pathname: '/',
                hostname: 'localhost',
            }
        });

        const configuration = {
            test: 'fallback',
            local: {
                test: 'local',
            },
            qa: {
                test: 'qa',
            },
            qaMaster: {
                test: 'qaMaster',
            },
            qaFeature1: {
                test: 'qaFeature1',
            },
            qaFeature1SubFeature1: {
                test: 'qaFeature1SubFeature1',
            },
            qaFeature1SubFeature2: {
                test: 'qaFeature1SubFeature2',
            },
        };

        configInstance = new Configuration(platform);
        configInstance.setAll(configuration);
        configInstance.environments = environments;
        // Test to see if we don't set basePathMode=true that everything works as expected
        configInstance.check();
        let testNonBasePathMode = configInstance.get('test');
        expect(testNonBasePathMode).toEqual('local');

        platform.location.hostname = 'www.qa.com';
        platform.location.pathname = '/master';
        platform.location.port = '';

        configInstance = new Configuration(platform);
        configInstance.setAll(configuration);
        configInstance.environments = environments;
        configInstance.check();
        testNonBasePathMode = configInstance.get('test');
        expect(testNonBasePathMode).toEqual('qa');

        // Test to see if our qa config works with a base path for application
        configInstance.setBasePathMode(true);
        configInstance.check();
        let testQa = configInstance.get('test');
        expect(testQa).toEqual('qaMaster');

        platform.location.pathname = '/feature1';
        configInstance = new Configuration(platform);
        configInstance.setBasePathMode(true);
        configInstance.setAll(configuration);
        configInstance.environments = environments; configInstance.check();
        testQa = configInstance.get('test');
        expect(testQa).toEqual('qaFeature1');

        platform.location.pathname = '/feature1/subfeature1';
        configInstance = new Configuration(platform);
        configInstance.setBasePathMode(true);
        configInstance.setAll(configuration);
        configInstance.environments = environments; configInstance.check();
        testQa = configInstance.get('test');
        expect(testQa).toEqual('qaFeature1SubFeature1');

        platform.location.pathname = '/feature1/subfeature2';
        configInstance = new Configuration(platform);
        configInstance.setBasePathMode(true);
        configInstance.setAll(configuration);
        configInstance.environments = environments; configInstance.check();
        testQa = configInstance.get('test');
        expect(testQa).toEqual('qaFeature1SubFeature2');
    });

    it('should get nested values from dicts', () => {
        const nestedDict = {
            level1: 'level1',
            nested1: {
                nested12: 'nested12',
                nested2: {
                    nested21: 'nested21',
                },
            },
        };
        configInstance.setAll(nestedDict);

        expect(configInstance.getDictValue(nestedDict, 'level1')).toEqual('level1');
        expect(configInstance.getDictValue(nestedDict, 'nested1.nested12')).toEqual('nested12');
        expect(configInstance.getDictValue(nestedDict, 'nested1.nested2.nested21')).toEqual(
            'nested21',
        );

        expect(configInstance.getDictValue(nestedDict['nested1'], 'nested2.nested21')).toEqual(
            'nested21',
        );

        expect(configInstance.getDictValue(nestedDict['nested1']['nested2'], 'nested21')).toEqual(
            'nested21',
        );

        expect(function () {
            configInstance.getDictValue(nestedDict, 'nonExisting');
        }).toThrow();
    });

    it('should get nested values from configs', () => {
        const nestedDict = {
            level1: 'level1',
            nested1: {
                nested12: 'nested12',
                nested2: {
                    nested21: 'nested21',
                },
            },
        };
        configInstance.setAll(nestedDict);

        expect(configInstance.get('level1')).toEqual('level1');
        expect(configInstance.get('nested1.nested12')).toEqual('nested12');
        expect(configInstance.get('nested1.nested2.nested21')).toEqual('nested21');
        expect(configInstance.get('nested1.nested2')).toEqual({ nested21: 'nested21' });
        expect(configInstance.get('nested1.nested2.nested21')).toEqual('nested21');
        expect(function () {
            configInstance.getDictValue(nestedDict, 'nonExisting');
        }).toThrow();
    });

    it('should prefer environment values from configs', () => {
        const nestedDict = {
            level1: 'level1',
            nested1: {
                nested12: 'nested12',
                nested2: {
                    nested21: 'nested21',
                },
                nested13: 'nested13',
            },
            dev2: {
                level1: 'level1e',
                nested1: {
                    nested12: 'nested12e',
                    nested2: {
                        nested21: 'nested21e',
                    },
                },
            },
        };
        configInstance.setAll(nestedDict);
        configInstance.environment = 'dev2';

        expect(configInstance.get('level1')).toEqual('level1e');
        expect(configInstance.get('nested1.nested12')).toEqual('nested12e');
        expect(configInstance.get('nested1.nested2.nested21')).toEqual('nested21e');
        expect(configInstance.get('nested1.nested2')).toEqual({ nested21: 'nested21e' });
        expect(configInstance.get('nested1.nested2.nested21')).toEqual('nested21e');
        expect(configInstance.get('nested1.nested13')).toEqual('nested13');
        expect(configInstance.get('nonExisting', 'default')).toEqual('default');
        expect(function () {
            configInstance.getDictValue(nestedDict, 'nonExisting');
        }).toThrow();
    });
});