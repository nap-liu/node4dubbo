/**
 * Created by liuxi on 2019/01/18.
 */
import {
  createClient,
  State,
  Event,
  Client,
  ClientError,
  CreateMode
} from 'node-zookeeper-client'
import {
  Option,
  Service
} from '../../typings/consumer'
import url = require('url')
import { UrlObject, UrlWithParsedQuery } from 'url'
import os = require('os')
import path = require('path')

import { Consumer } from './index'

const debug = require('debug')('dubbo:consumer:zookeeper')

/**
 * zk 客户端封装
 */
class Zookeeper {
  client: Client
  parent: Consumer
  option: Option

  children: UrlWithParsedQuery[]

  constructor (option: Option, parent: Consumer) {
    this.option = option
    this.parent = parent
    this.connect()
  }

  connect () {
    const {option} = this
    debug('开始连接zk服务器', option.address, option.path)
    if (this.client) {
      debug('丢弃已经存在的zk客户端')
      this.client.close()
      this.client = null
    }
    this.client = createClient(option.address, option)
    this.client.on('state', this.stateChange.bind(this))
    this.client.connect()
  }

  emit (event: string | symbol, ...args: any[]) {
    if (this.parent) {
      this.parent.emit(event, ...args)
    }
  }

  /**
   * 服务器已连接
   */
  stateChange (state: State) {
    debug('zk状态改变', state)
    switch (state) {
      case State.SYNC_CONNECTED:
        debug('zk已连接 开始获取zk节点')
        this.loadProviders()
        break
      case State.CONNECTED_READ_ONLY:
        debug('zk连接到只读服务器 抛出错误')
        this.emit('error', state, {
          option: this.option
        })
        break
      case State.DISCONNECTED:
        debug('zk连接失败')
        this.emit('error', state, {
          option: this.option
        })
        break
      case State.AUTH_FAILED:
        debug('zk连接认证失败')
        this.emit('error', state, {
          option: this.option
        })
        this.clear()
        break
      case State.EXPIRED:
        debug('zk连接已过期 开始重试连接zk')
        this.connect()
        break
    }
  }

  /**
   * 清理zk连接 清理内存关联信息
   */
  clear () {
    if (this.client && this.client.close) {
      this.client.close()
      this.client = null
      this.option = null
      this.parent.zookeeper = null
      this.parent = null
    }
  }

  loadProviders () {
    const {path, services} = this.option
    Object.keys(services).forEach(serviceName => {
      const service = services[serviceName]
      const {interface: _interface} = service
      const providerPath = `/${path}/${_interface}/providers`
      const configuratorsPath = `/${path}/${_interface}/configurators`

      let providers: UrlWithParsedQuery[] = []
      let configs: UrlWithParsedQuery[] = []

      let initedConfig = false
      const nodeChange = (type: string, list: string[]) => {
        if (initedConfig === false) {
          initedConfig = true
          this.subscribe(providerPath, service, serviceName, nodeChange.bind(this, 'providers'))
        }
        const parsedList = this.parse(list)
        debug('监听zk路径数据发生变化', type, parsedList.map(i => i.href))
        if (type === 'providers') {
          providers = parsedList
        } else {
          configs = parsedList
        }

        const outProviders = providers.map(provider => {
          const config = configs.find(i => `${i.host}${i.pathname}` === `${provider.host}${provider.pathname}`)
          return {
            ...provider,
            query: Object.assign({}, provider.query, config && config.protocol === 'override:' && config.query)
          }
        })

        if (type === 'providers') {
          this.parent.providerReady(serviceName, service, outProviders)
        }
      }
      this.subscribe(configuratorsPath, service, serviceName, nodeChange.bind(this, 'configs'))
    })
  }

  subscribe (path: string, service: Service, serviceName: string, callback: (...args: any) => void) {
    let disabled = false

    const watcherNodeChange = (event: Event) => {
      if (disabled) {
        debug('zk 已停止监听', path)
        return
      }
      debug('zk 节点变更', path)
      listener()
    }

    const loadChildren = (error: ClientError, children: string[]) => {
      if (disabled) {
        debug('zk 已停止获取节点', path)
        return
      }
      if (error) {
        this.emit('error', error, {
          service,
          serviceName
        })
        return
      }
      callback(children)
    }

    const listener = () => {
      if (disabled) {
        return
      }
      this.client.getChildren(path, watcherNodeChange, loadChildren)
    }

    listener()

    return () => {
      disabled = true
    }
  }

  parse (children: string[]): UrlWithParsedQuery[] {
    return children.map(service => {
      service = decodeURIComponent(service)
      return url.parse(service, true)
    })
  }
}

function isLoopback (addr: string) {
  return (
    /^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/.test(addr) ||
    /^fe80::1$/.test(addr) ||
    /^::1$/.test(addr) ||
    /^::$/.test(addr)
  )
}

function ip (): string {
  const interfaces = os.networkInterfaces()
  return Object.keys(interfaces).map(function (nic) {
    const addresses = interfaces[nic].filter(function (details) {
      return details.family.toLowerCase() === 'ipv4' && !isLoopback(details.address)
    })
    return addresses.length ? addresses[0].address : undefined
  }).filter(Boolean)[0]
}

class ZookeeperConsumer {
  option: Option
  client: Zookeeper
  parent: Consumer

  constructor (client: Zookeeper, option: Option, dubbo: Consumer) {
    this.option = option
    this.client = client
    this.parent = dubbo
    Object.keys(option.services).forEach(key => {
      this.createPath(option.services[key])
    })
  }

  createPath (service: Service) {
    const {option} = this
    const info: UrlObject = {
      protocol: 'consumer',
      slashes: true,
      host: '',
      query: {
        application: option.application,
        category: 'consumers',
        check: 'false',
        dubbo: option.version,
        interface: service.interface,
        connected: 'true',
        revision: '',
        version: option.version,
        side: 'consumer',
        methods: Object.keys(service.methods).join(),
        timestamp: new Date().getTime()
      }
    } as UrlObject

    info.host = `${ip()}/${service.interface}`
    const regsiterPath = `/${option.path}/${service.interface}/consumers/${encodeURIComponent(url.format(info))}`
    debug('注册consumer', regsiterPath)
    this.createConsumer(regsiterPath)
  }

  exists (registerPath: string) {
    return new Promise((resolve, reject) => {
      const dirPath = path.dirname(registerPath)
      debug('检查注册zk根路径是否存在', dirPath)
      this.client.client.exists(dirPath, (error, stat) => {
        if (error) {
          reject(error)
          return
        } else if (stat) {
          resolve()
        } else {
          this.client.client.create(dirPath, CreateMode.PERSISTENT, (error) => {
            if (error) {
              reject(error)
            } else {
              resolve()
            }
          })
        }
      })
    })
  }

  checkAndRegister (registerPath: string) {
    return new Promise((resolve, reject) => {
      this.client.client.exists(registerPath, (error, stat) => {
        if (error) {
          reject(error)
          debug(`createConsumer 出错 ${registerPath}`)
        } else if (stat) {
          resolve()
          debug(`createConsumer 已经存在 ${registerPath}`)
        } else {
          debug(`createConsumer 不存在开始注册 ${registerPath}`)
          this.client.client.create(registerPath, CreateMode.EPHEMERAL, (error, node) => {
            if (error) {
              reject(error)
              debug(`createConsumer 注册出错 ${registerPath}`, error)
            } else {
              resolve()
              debug(`createConsumer 注册成功 ${registerPath}`)
            }
          })
        }
      })
    })
  }

  async createConsumer (registerPath: string) {
    try {
      await this.exists(registerPath)
      await this.checkAndRegister(registerPath)
    } catch (e) {
      this.parent.emit('error', e)
    }
  }
}

export { ZookeeperConsumer, Zookeeper }
