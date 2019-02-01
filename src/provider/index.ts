/**
 * Created by liuxi on 2019/01/31.
 */
import { EventEmitter } from 'events'
import { Option } from '../../typings/provider'
import { Service } from './service'

class Provider extends EventEmitter {

  services: Service[]

  constructor (option: Option) {
    super()
    this.services = []
  }

  use (handler: Service) {
    this.services.push(handler)
  }

  start () {

  }
}

export { Provider }
