/// <reference path="../../typings/debug.d.ts" />
/**
 * Created by liuxi on 2019/01/18.
 */
import { EventEmitter } from 'events'
import * as _ from 'lodash'

const debug = require('debug')('dubbo:consumer:index')

import { IProvider, Option, Service as ServiceDefine } from '../../typings/consumer'
import { Zookeeper, ZookeeperConsumer } from './zookeeper'
import { Service } from './service'
import { UrlWithParsedQuery } from 'url'

/**
 * dubbo 客户端
 */
class Consumer extends EventEmitter {
  option: Option
  zookeeper: Zookeeper
  zookeeperConsumer: ZookeeperConsumer
  readys: {
    [x: string]: {
      ready: boolean;
      resolve: Function[]
    }
  }
  proxy: any

  static default (baseOption: Option) {
    return function ConsumerFactory (option: Option) {
      return new Consumer(_.merge({}, baseOption, option))
    }
  }

  constructor (option: Option) {
    super()
    if (!option.address) {
      throw new Error('zookeeper address 不能为空')
    }

    if (!option.application) {
      throw new Error('zookeeper application 不能为空')
    }

    if (!option.path) {
      throw new Error('zookeeper path 路径不能为空')
    }
    if (!option.version) {
      throw new Error('dubbo version 不能为空')
    }

    this.option = _.merge({
      version: '2.5.3.6',
      sessionTimeout: 30000,
      spinDelay: 1000,
      retries: 5
    }, option)

    this.readys = Object.keys(option.services).reduce((map: any, name) => {
      map[name] = {
        ready: false,
        resolve: []
      }
      return map
    }, {})

    this.initialZookeeper()
    this.registerConsumer()

    this.proxy = {}
    this.proxy.on = this.on.bind(this)
    this.proxy.ready = this.ready.bind(this)

    return this.proxy
  }

  registerConsumer () {
    debug('注册dubbo消费节点')
    this.zookeeperConsumer = new ZookeeperConsumer(this.zookeeper, this.option, this)
  }

  initialZookeeper () {
    debug('开始连接zk')
    this.zookeeper = new Zookeeper(this.option, this)
  }

  providerReady (serviceName: string, service: ServiceDefine, providers: UrlWithParsedQuery[]) {
    debug('发现 provider', providers.map(item => `${item.hostname}:${item.port} ${item.query.interface}@${item.query.version} version: ${item.query.dubbo} profile: ${item.query.profile} env: ${item.query.environment}`).join('|'))
    service.dubboVersion = this.option.version
    const {providerFilter = () => true} = this.option

    const matchedProviders = providers.filter(provider => {
      const result = providerFilter(service, provider.query as any as IProvider)
      return (
        provider.query.group === service.group &&
        provider.query.version === service.version &&
        provider.protocol === 'dubbo:' &&
        (result === true || result === undefined)
      )
    })

    if (matchedProviders.length === 0) {
      this.emit('error', new Error(`没有找到匹配的 ${serviceName} provider`), {
        service,
        serviceName,
        providers
      })
      return
    }

    if (this.proxy[serviceName]) {
      debug(
        'provider 已经存在 diff 服务列表',
        matchedProviders.map(item => `${item.hostname}:${item.port} ${item.query.interface}@${item.query.version}`).join()
      )
      this.proxy[serviceName].________NOT_INVOKE_THIS_______(service, matchedProviders)
    } else {
      debug(
        'provider 不存在 创建新服务',
        matchedProviders.map(item => `${item.hostname}:${item.port} ${item.query.interface}@${item.query.version}`).join()
      )
      this.proxy[serviceName] = new Service(serviceName, service, matchedProviders, this)
    }
  }

  async ready (service?: string) {
    const services = this.option.services
    const serviceNames = Object.keys(services)
    if (service) {
      if (!services[service]) {
        throw new Error(`${service} service不存在 `)
      }
    } else if (serviceNames.length) {
      service = serviceNames[0]
    } else {
      throw new Error('该dubbo没有声明对应service')
    }

    let ready = this.readys[service]

    if (ready.ready) {
      return this
    } else {
      return new Promise((resolve) => {
        ready.resolve.push(resolve)
      })
    }
  }
}

export { Consumer }
