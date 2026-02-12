declare module 'saxon-js' {
  export function transform(options: any): any;
  export function compile(doc: any): any;
  export function getResource(options: any): Promise<any>;
  export function getPlatform(): any;
}
