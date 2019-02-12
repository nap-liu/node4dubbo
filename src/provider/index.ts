/**
 * Created by liuxi on 2019/01/31.
 */
import { Option } from '../../typings/provider'
import { Service } from './service'
import { Zookeeper } from './zookeeper'
import { Server } from './server'
import * as _ from 'lodash'
import { Context } from './context'
import { compose } from '../common/util'
import { ServerTimeout, ServiceError, ServiceNotFound } from './exception'

const debug = require('debug')('dubbo:provider:index')

const getNotFoundErrorInfo = (ctx: Context, services: Service[]) => `${ctx.interface}#${ctx.method}@${ctx.version} in [${services.map(s => s.option.interface)}]`

const getTimeoutErrorInfo = (ctx: Context) => `${ctx.interface}#${ctx.method}@${ctx.version}`

class Provider extends Zookeeper {
  services: Service[]
  option: Option
  server: Server
  middleware: Function[]

  constructor (option: Option) {
    super(option)
    this.services = []
    this.middleware = []

    if (!option) {
      throw new Error('option 不能为空')
    }

    if (!option.application) {
      throw new Error('option.application 不能为空')
    }

    if (!option.application.name) {
      throw new Error('option.application.name 不能为空')
    }

    if (!option.zookeeper) {
      throw new Error('option.zookeeper 不能为空')
    }

    if (!option.zookeeper.address) {
      throw new Error('option.zookeeper.address 不能为空')
    }

    if (!option.zookeeper.path) {
      throw new Error('option.zookeeper.path 不能为空')
    }

    this.option = _.merge({
      executes: 1000,
      version: '2.5.3.6',
      ip: '0.0.0.0',
      port: 20880,
      timeout: 1000 * 5,
      zookeeper: {
        sessionTimeout: 30000,
        spinDelay: 1000,
        retries: 5
      }
    } as Option, option)
  }

  use (middleware: Function) {
    this.middleware.push(middleware)
  }

  addService (service: Service) {
    debug('添加服务')
    this.services.push(service)
  }

  invoke (context: Context) {
    debug(`客户端调用`)
    const service = this.services.find(s => s.option.interface === context.interface && s.option.version === context.version)
    if (service) {
      const fn = service.methods[context.method]
      if (typeof fn === 'function') {
        const fns = compose(...this.middleware, fn)
        Promise.race([
          fns(context),
          new Promise((resolve, reject) => {
            setTimeout(reject, this.option.timeout, new ServerTimeout(`调用服务超时 ${getTimeoutErrorInfo(context)}`))
          })
        ]).then(context.response).catch((e) => {
          context.result = e
          context.response()
        })
      } else {
        context.result = new ServiceNotFound(`调用服务不存在 ${getNotFoundErrorInfo(context, this.services)}`)
        context.response()
      }
    } else {
      context.result = new ServiceNotFound(`调用服务不存在 ${getNotFoundErrorInfo(context, this.services)}`)
      context.response()
    }
  }

  start (ready?: Function) {
    debug('启动服务')
    this.server = new Server(this.option.ip, this.option.port)
    this.server.on('done', () => {
      debug('开始启动 zookeeper')
      this.connect()
      this.server.on('invoke', this.invoke.bind(this))
      this.server.on('error', this.emit.bind(this, 'error'))
      this.server.on('close', this.emit.bind(this, 'close'))

      if (typeof ready === 'function') {
        ready(this)
      }
    })
  }
}

export { Provider }
