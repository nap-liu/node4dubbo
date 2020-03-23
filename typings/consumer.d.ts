/// <reference path="./js-to-java.d.ts" />
// dubbo类型
/**
 * 初始化dubbo服务参数
 */

import { connectOption } from 'node-zookeeper-client'
import { UrlWithParsedQuery } from 'url'
import { Socket } from '../src/consumer/socket'
import java = require('js-to-java')
import { EventEmitter } from 'events'

declare class Consumer extends EventEmitter {
  /**
   * 代理服务方法
   */
  [x: string]: {
    [x: string]: proxyFunction;
  } | any;

  /**
   * 客户端已连接
   * @param {string} serviceName
   * @returns {Promise<Consumer>}
   */
  ready (serviceName: string): Promise<Consumer>;
}

/**
 * 该参数会透传给 node-zookeeper-client 模块
 */
export interface Option extends connectOption {
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
   * 筛选使用的provider
   * @param service 当前服务
   * @param provider 所有存在的服务
   */
  providerFilter?: (service: Service, provider: IProvider) => boolean;
  /**
   * 远程dubbo接口interface声明
   */
  services: {
    [x: string]: Service
  };
}

export interface IProvider {
  anyhost: string;
  application: string;
  'application.version': string;
  'default.executes': string;
  'default.threads': string;
  'default.timeout': string;
  dubbo: string;
  environment: string;
  interface: string;
  logger: string;
  methods: string;
  organization: string;
  owner: string;
  pid: string;
  profile: string;
  revision: string;
  side: string;
  timestamp: string;
  version: string;
}

export type params = (param: any, java: Function) => any;
export type attachmentsFunction = (invokePackage: InvokePackage) => any;
export type attachmentsObject = {
  [x: string]: string | number
};

export interface Service {
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

export interface Provider extends UrlWithParsedQuery {
  socket: Socket;
  retryCount: number;
}

export interface InvokePackage {
  resolve: Function;
  reject: Function,
  method: string;
  args: any[];
  service: Service;
  id?: number;
  startInvoke?: Function;
}

type proxyFunction = (...args: any[]) => Promise<any>
