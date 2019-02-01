/**
 * Created by liuxi on 2019/01/31.
 */
import { ServiceOption } from '../../typings/provider'

class Service {
  option: ServiceOption
  methods: { [x: string]: Function }

  constructor (option: ServiceOption) {
    this.option = option
    this.methods = {}
  }

  on (method: string, ...middlewares: Function[]) {
    this.methods[method] = middlewares[0]
  }
}

export { Service }
