/**
 * Created by liuxi on 2019/01/18.
 */
import { InvokePackage, Provider, Service as ServiceDefine } from '../../typings/consumer'
import { UrlWithParsedQuery } from 'url'
import { Socket } from './socket'
import java = require('js-to-java')
import { Consumer } from './index'

const debug = require('debug')('dubbo:consumer:service')

class Service {
  service: ServiceDefine
  providers: Provider[]
  parent: Consumer
  name: string
  index: number
  proxy: any

  constructor (serviceName: string, service: ServiceDefine, providers: UrlWithParsedQuery[], dubbo: Consumer) {
    this.parent = dubbo
    this.service = service
    this.name = serviceName
    this.index = 0
    this.proxy = {}

    this.providers = providers.map((provider: Provider) => {
      provider.socket = new Socket(provider, this)
      provider.retryCount = 1
      return provider
    })

    debug('创建dubbo线程池', this.providers.length)
    debug('注入实例方法', this.service.interface)
    this.injectInvokeProxy()
    process.nextTick(this.ready.bind(this))
    this.proxy.________NOT_INVOKE_THIS_______ = this.merge.bind(this)
    return this.proxy
  }

  ready () {
    debug('服务初始化完成', this.service.interface)
    this.emit('dubbo-ready', this.parent, this.service)
    if (this.parent && this.parent.ready && this.parent.readys[this.name]) {
      const ready = this.parent.readys[this.name]
      ready.ready = true
      ready.resolve.forEach(item => {
        item(this.parent.proxy)
      })
      ready.resolve = []
    }
  }

  /**
   * 使用父元素的event通知外部状态
   * @param {string | symbol} event
   * @param args
   * @private
   */
  emit (event: string | symbol, ...args: any[]) {
    if (this.parent) {
      this.parent.emit(event, ...args)
    }
  }

  /**
   * 注册代理方法
   * @private
   */
  injectInvokeProxy () {
    const allMethods: Map<string, Provider> = new Map()
    this.providers.forEach(provider => {
      const {methods} = provider.query;
      (methods as string).split(',').forEach((item: string) => {
        allMethods.set(item, provider)
      })
    })
    allMethods.forEach((provider: Provider, method) => {
      this.proxy[method] = this.invoke(method, provider)
    })
  }

  /**
   * 调用远程dubbo方法
   * @param {string} method
   * @param {Provider} provider
   * @returns {(...args: any[]) => Promise<any>}
   * @private
   */
  invoke (method: string, provider: Provider) {
    return (...args: any[]) => {
      return new Promise(async (resolve, reject) => {
        const {service} = this
        const {methods} = service
        if (methods && methods[method]) {
          if (methods[method].length === args.length) {
            args = args.map((param, index) => {
              const func = methods[method][index] || (param => param)
              return func(param, java)
            })
          } else {
            reject(new Error(`参数错误：${service.interface}.${method} 声明参数为 ${methods[method].length} 个 实际传递为 ${args.length}`))
            return
          }
        }
        this.getProvider((provider: Provider) => {
          let timer: NodeJS.Timeout

          const invoker = {
            resolve: (params: any) => {
              clearTimeout(timer)
              resolve(params)
            },
            reject: (params: any) => {
              clearTimeout(timer)
              reject(params)
            },
            method,
            args,
            service: service
          } as InvokePackage

          provider.socket.invoke(invoker).then(() => {
            timer = setTimeout(() => {
              try {
                reject(new Error(`provider: ${provider.hostname}:${provider.port} ${service.interface}.${method}@${invoker.id} 调用超时`))
              } catch (e) {
                debug('回调业务出错', e)
              }
              provider.socket.cancel(invoker)
            }, +provider.query['default.timeout'] || 1000 * 5)
          }).catch(reject)
        })
      })
    }
  }

  /**
   * 从线程池中选取空闲的线程执行dubbo调用
   * @returns {Promise<Provider>}
   * @private
   */
  getProvider (callback: Function) {
    if (this.providers.length) {
      const provider = this.providers[this.index++]
      if (provider) {
        callback(provider)
      } else {
        this.index = 0
        this.getProvider(callback)
      }
    } else {
      throw new Error(`interface ${this.service.interface} 没有提供 provider`)
    }
  }

  /**
   * 删除指定socket连接池
   * @param {Provider} provider
   * @private
   */
  closeProvider (provider: Provider) {
    if (Array.isArray(this.providers)) {
      const dels: number[] = []

      this.providers.forEach((item: Provider, index: number) => {
        if (item === provider) {
          item.socket.clear(false)
          dels.push(index)
        }
      })

      dels.reverse().forEach(item => {
        this.providers.splice(item, 1)
      })
    }
  }

  /**
   * 手动关闭 service 释放相关内存
   * @private
   */
  close () {
    if (Array.isArray(this.providers)) {
      this.providers.forEach((item: Provider, index: number) => {
        item.socket.clear(false)
      })
      this.providers = null
      this.parent = null
      this.service = null
      Object.keys(this.proxy).forEach(key => {
        delete this.proxy[key]
      })
    }
  }

  /**
   * socket异常断开 重连服务
   * @param {Provider} provider
   * @private
   */
  socketClose (provider: Provider) {
    if (provider.retryCount === 1) {
      provider.retryCount += 1
    } else {
      provider.retryCount *= provider.retryCount
    }
    debug(
      '线程池socket异常断开 开始重试',
      `${provider.hostname}:${provider.port} ${provider.query.interface}@${provider.query.version}`
    )
    setTimeout(() => {
      this.emit('dubbo-socket-retry', provider)
      provider.socket = new Socket(provider, this)
    }, 1000 * provider.retryCount)
  }

  /**
   * 新老service合并
   * @param service
   * @param children
   * @private
   */
  merge (service: ServiceDefine, children: UrlWithParsedQuery[]) {
    const newLinks: Provider[] = children.filter(provider => {
      return this.providers.findIndex(item =>
        item.hostname === provider.hostname &&
        item.port === provider.port &&
        item.query.pid === provider.query.pid
      ) === -1

    }) as Provider[]

    const removeLinks: Provider[] = this.providers.filter(provider => {
      return children.findIndex(item =>
        item.hostname === provider.hostname &&
        item.port === provider.port &&
        item.query.pid === provider.query.pid
      ) === -1
    })

    removeLinks.forEach(item => {
      this.closeProvider(item)
    })

    debug(
      'service provider 变化 diff 新老 provider 新建provider',
      newLinks.length,
      newLinks.map(item => `${item.hostname}:${item.port}:${item.query.pid} ${item.query.interface}@${item.query.version}`).join()
    )
    debug(
      'service provider 变化 diff 新老 provider 移除provider',
      removeLinks.length,
      removeLinks.map(item => `${item.hostname}:${item.port}:${item.query.pid} ${item.query.interface}@${item.query.version}`).join()
    )

    debug('service provider 老provider数量', this.providers.length)
    this.service = service

    // 重新生成新的prodiver线程池
    this.providers = [
      ...this.providers,
      // 生成新线程池
      ...newLinks.map((provider: Provider) => {
        provider.socket = new Socket(provider, this)
        return provider
      })
    ]
    debug('service provider 新provider数量', this.providers.length)

    this.injectInvokeProxy()
    this.emit('dubbo-server-merge', children, this.providers)
  }

}

export { Service }
