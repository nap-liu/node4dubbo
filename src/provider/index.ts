/**
 * Created by liuxi on 2019/01/31.
 */
import { Option } from '../../typings/provider'
import { Service } from './service'
import { Zookeeper } from './zookeeper'
import { Server } from './server'
import * as _ from 'lodash'

const debug = require('debug')('dubbo:provider:index')

class Provider extends Zookeeper {
  services: Service[]
  option: Option
  server: Server

  constructor (option: Option) {
    super(option)
    this.services = []
    this.option = _.merge({
      executes: 1000,
      version: '2.5.3.6',
      zookeeper: {
        sessionTimeout: 30000,
        spinDelay: 1000,
        retries: 5
      }
    } as Option, option)
  }

  use (service: Service) {
    debug('添加服务')
    this.services.push(service)
  }

  start (ready?: Function) {
    debug('启动服务')
    this.server = new Server(this.option.ip, this.option.port)
    this.server.on('done', () => {
      debug('开始启动 zookeeper')
      this.connect()
    })
  }
}

export { Provider }
