/// <reference path="./node-zookeeper-client.d.ts" />

import {EventEmitter} from "events";
import {connectOption} from 'node-zookeeper-client';

export class Provider extends EventEmitter {

}

export interface Option extends connectOption {
    ip: string,
    port: number,
    token: string,

}
