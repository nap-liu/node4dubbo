/**
 * Created by liuxi on 2019/01/31.
 */
import {
  createClient,
  State,
  Client,
  CreateMode,
  Exception,
  connectOption,
  childrenCallback
} from 'node-zookeeper-client'
import { EventEmitter } from 'events'
import path = require('path')

const debug = require('debug')('dubbo:common:zookeeper')

class Zookeeper extends EventEmitter {
  /**
   * Zookeeper client
   */
  client: Client
  option: connectOption
  address: string

  constructor (address: string, option: connectOption) {
    super()
    debug(`初始化 zookeeper`)
    this.address = address
    this.option = option
    this.connect()
  }

  connect () {
    debug(`开始 zookeeper 连接 ${this.address}`)
    if (this.client) {
      debug(`丢弃当前 zookeeper 客户端`)
      this.client.close()
      this.client = null
    }
    this.client = createClient(this.address, this.option)
    this.client.on('state', this.stateChange.bind(this))
    this.client.connect()
  }

  stateChange (state: State) {
    debug('zookeeper 状态改变', state)
    this.emit('state', state)
    switch (state) {
      case State.AUTH_FAILED:
        debug('zookeeper 连接认证失败')
        this.clear()
        break
      case State.EXPIRED:
        debug('zookeeper 连接已过期 开始重试连接')
        this.connect()
        break
    }
  }

  clear () {
    if (this.client) {
      this.eventNames().map(event => {
        this.removeAllListeners(event)
      })
      this.client.close()
      this.client = null
      this.option = null
      this.address = null
    }
  }

  /**
   * 获取子节点并且持续监听该节点变动
   * @param path
   * @param watcher
   */
  getChildren (path: string, watcher: childrenCallback): void {
    this.client.getChildren(path, watcher)
  }

  /**
   * 检查路径节点是否存在
   * @param registerPath
   */
  exists (registerPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      debug('检查注册 zookeeper 根路径是否存在', registerPath)
      this.client.exists(registerPath, (error, stat) => {
        if (error) {
          reject(error)
        } else if (stat) {
          resolve()
        } else {
          reject()
        }
      })
    })
  }

  /**
   * 注册指定路径节点 如果客户端掉线则自动移除节点
   * @param registerPath
   * @param mode
   */
  createPath (registerPath: string, mode: CreateMode = CreateMode.EPHEMERAL): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.create(registerPath, mode, (error, node) => {
        if (error) {
          if (error.getCode() === Exception.NODE_EXISTS) {
            debug(`createPath 注册成功 ${registerPath}`)
            resolve()
          } else {
            debug(`createPath 注册出错 ${registerPath}`, error)
            reject(error)
          }
        } else {
          resolve()
          debug(`createPath 注册成功 ${registerPath}`)
        }
      })
    })
  }
}

export { Zookeeper, CreateMode }
