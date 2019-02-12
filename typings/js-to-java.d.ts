/**
 * Created by liuxi on 2019/01/18.
 */

declare module 'js-to-java' {
  function java (type: string): any;

  namespace java {
    export const revert: (data: any) => any
    export const abstract: (abstractClassname: string, classname: string, value: any) => any
    export const combine: (classname: string, value: any) => any
    export const Class: (classname: string) => any
    export const Locale: (locale: string, handle: string) => any
    export const BigDecimal: (decimal: string) => any
    export const exception: (error: Error, classname?: string) => any

    export function array (classname: string, values: any[]): any

    export namespace array {
      export const Boolean: (values: boolean[]) => any
      export const boolean: (values: boolean[]) => any
      export const Integer: (values: number[]) => any
      export const int: (values: number[]) => any
      export const short: (values: number[]) => any
      export const Short: (values: number[]) => any
      export const byte: (values: number[]) => any
      export const Byte: (values: number[]) => any
      export const long: (values: number[]) => any
      export const Long: (values: number[]) => any
      export const double: (values: number[]) => any
      export const Double: (values: number[]) => any
      export const float: (values: number[]) => any
      export const Float: (values: number[]) => any
      export const String: (values: string[]) => any
      export const char: (values: string[]) => any
      export const chars: (values: string[]) => any
      export const Character: (values: string[]) => any
      export const List: (values: any[]) => any
      export const Set: (values: any[]) => any
      export const Collection: (values: any[]) => any
      export const Iterator: (values: any[]) => any
      export const Enumeration: (values: any[]) => any
      export const HashMap: (values: any[]) => any
      export const Map: (values: any[]) => any
      export const Dictionary: (values: any[]) => any
    }

    export const Boolean: (value: boolean) => any
    export const boolean: (value: boolean) => any
    export const Integer: (value: number) => any
    export const int: (value: number) => any
    export const short: (value: number) => any
    export const Short: (value: number) => any
    export const byte: (value: number) => any
    export const Byte: (value: number) => any
    export const long: (value: number) => any
    export const Long: (value: number) => any
    export const double: (value: number) => any
    export const Double: (value: number) => any
    export const float: (value: number) => any
    export const Float: (value: number) => any
    export const String: (value: string) => any
    export const char: (value: string) => any
    export const chars: (value: string) => any
    export const Character: (value: string) => any
    export const List: (value: any) => any
    export const Set: (value: any) => any
    export const Collection: (value: any) => any
    export const Iterator: (value: any) => any
    export const Enumeration: (value: any) => any
    export const HashMap: (value: any) => any
    export const Map: (value: any) => any
    export const Dictionary: (value: any) => any

  }
  export = java
}
