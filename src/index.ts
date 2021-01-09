import { Configuration, IConfiguration } from './aurelia-configuration';
import { IContainer, IRegistry } from "aurelia";



export class AureliaConfiguration implements IRegistry {
    #config?: IConfiguration | Configuration;
    register(container: IContainer): void {
        container.register(this.#config ?? IConfiguration);
    }
    static config(config: IConfiguration | Configuration): AureliaConfiguration {
        const instance = new AureliaConfiguration();
        instance.#config = config;
        return instance;
    }
}