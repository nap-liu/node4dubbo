/**
 * Created by liuxi on 2019/01/31.
 */
import {
  createClient,
  State,
  Client,
  CreateMode,
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
      const dirPath = path.dirname(registerPath)
      debug('检查注册 zookeeper 根路径是否存在', dirPath)
      this.client.exists(dirPath, (error, stat) => {
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
   */
  createPath (registerPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.create(registerPath, CreateMode.EPHEMERAL, (error, node) => {
        if (error) {
          reject(error)
          debug(`createConsumer 注册出错 ${registerPath}`, error)
        } else {
          resolve()
          debug(`createConsumer 注册成功 ${registerPath}`)
        }
      })
    })
  }
}

export { Zookeeper }
