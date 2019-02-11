/**
 * Created by liuxi on 2019/01/31.
 */
import { ServiceOption } from '../../typings/provider'
import { compose } from '../common/util'

class Service {
  option: ServiceOption
  methods: { [x: string]: Function }

  constructor (option: ServiceOption) {
    if (!option) {
      throw new Error('option 不能为空')
    }

    if (!option.interface) {
      throw new Error('option.interface 不能为空')
    }

    if (!option.version) {
      throw new Error('option.version 不能为空')
    }

    this.option = option
    this.methods = {}
  }

  method (name: string, ...middleware: Function[]) {
    this.methods[name] = compose(...middleware)
  }
}

export { Service }
