/// <reference path="./node-zookeeper-client.d.ts" />

import { EventEmitter } from 'events'
import { connectOption } from 'node-zookeeper-client'

declare class Provider {

}

export interface Option extends connectOption {
  /**
   * 应用描述
   */
  application: {
    /**
     * 应用名称
     */
    name: string,
    /**
     * 应用版本
     */
    version?: string,
  },
  /**
   * 监听ip
   */
  ip: string,
  /**
   * 监听端口
   */
  port: number,
  /**
   * zookeeper 地址
   */
  address: string
  /**
   * 最大执行队列
   */
  executes?: number,
  /**
   * 运行环境
   */
  environment?: string,
  /**
   * 组织架构
   */
  organization?: string,
  /**
   * 应用负责人
   */
  owner?: string,
  /**
   * 修订版本号
   */
  revision?: string,

  /**
   * 启用zookeeper token验证
   */
  token?: string,
}

export interface ServiceOption {
  /**
   * 开放服务
   */
  interface: string,
  /**
   * 服务版本
   */
  version: string,
}
