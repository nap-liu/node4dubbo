declare module 'debug' {
  type log = (...args: any[]) => void;

  function debug (name: string): log;

  export = debug;
}
