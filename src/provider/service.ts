/**
 * Created by liuxi on 2019/01/31.
 */
import { ServiceOption } from '../../typings/provider'
import { compose } from '../common/util'

class Service {
  option: ServiceOption
  methods: { [x: string]: Function }

  constructor (option: ServiceOption) {
    this.option = option
    this.methods = {}
  }

  method (name: string, ...middleware: Function[]) {
    this.methods[name] = compose(...middleware)
  }
}

export { Service }
