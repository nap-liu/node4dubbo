/// <reference path="../typings/js-to-java.d.ts" />
// dubbo类型
/**
 * 初始化dubbo服务参数
 */

import {connectOption} from 'node-zookeeper-client'
import {UrlWithParsedQuery} from "url";
import Socket from '../src/socket';
import java = require('js-to-java');
import {EventEmitter} from 'events'

/**
 * 该参数会透传给 node-zookeeper-client 模块
 */
export interface DubboOption extends connectOption {
    /**
     * dubbo 在zookeeper中注册的根路径
     */
    path: string,

    /**
     * dubbo version
     */
    version: string,

    /**
     * 客户端的应用名称 用于zookeeper中注册使用
     */
    application: string,

    /**
     * zookeeper 服务器地址
     */
    address: string,

    /**
     * 远程dubbo接口interface声明
     */
    services: services;

    /**
     * 每个interface的线程池数量 默认 5
     */
    pool: number;
}

export type params = (param: any, java: java) => any;
export type attachmentsFunction = (invokePackage: InvokePackage) => any;
export type attachmentsObject = {
    [x: string]: string | number
};

export interface service {
    /**
     * 每个interface的线程池数量 自动赋值
     */
    pool: number;
    /**
     * dubbo version 自动赋值
     */
    dubboVersion: string;
    /**
     * interface 名称
     */
    interface: string;
    /**
     * interface 版本
     */
    version: string;
    /**
     * zookeeper 组
     */
    group?: string;
    /**
     * dubbo 是否启用token效验
     */
    token?: string;
    /**
     * dubbo context 附加内容
     */
    attachments?: attachmentsObject | attachmentsFunction,
    /**
     * interface 公开的函数声明 可以进行参数的转换
     */
    methods?: {
        [x: string]: params[]
    }
}

export interface services {
    [x: string]: service
}

export interface Provider extends UrlWithParsedQuery {
    socket: Socket;
    retryCount: number;
}

export interface InvokePackage {
    resolve: Function;
    reject: Function,
    method: string;
    args: any[];
    service: service;
}

type proxyFunction = (...args: any[]) => Promise<any>

export class DubboClient extends EventEmitter {
    /**
     * 代理服务方法
     */
    [x: string]: {
        [x: string]: proxyFunction;
    } | any;

    /**
     * 客户端已连接
     * @param {string} serviceName
     * @returns {Promise<DubboClient>}
     */
    ready(serviceName: string): Promise<DubboClient>;
}
