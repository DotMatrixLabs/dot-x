declare module 'conf' {
  class Conf<T extends Record<string, any> = Record<string, any>> {
    constructor(options?: {
      cwd?: string;
      configName?: string;
      fileExtension?: string;
      schema?: Record<string, any>;
      defaults?: Record<string, any>;
    });
    get<Key extends keyof T = any>(key: string, defaultValue?: any): any;
    set(key: string | Record<string, any>, value?: any): void;
    delete(key: string): void;
    clear(): void;
    has(key: string): boolean;
    readonly store: T;
    readonly path: string;
  }
  export default Conf;
}

