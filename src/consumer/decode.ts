/**
 * Created by liuxi on 2019/01/18.
 */
import { Protocol } from '../common/protocol'

const Decoder = require('hessian.js').DecoderV2

const RESPONSE_WITH_EXCEPTION = 0
const RESPONSE_VALUE = 1
const RESPONSE_NULL_VALUE = 2

class Decode {
  data: Buffer

  constructor (data: Buffer) {
    this.data = data
  }

  readResult (cb: Function) {
    const { data } = this
    const proto = new Protocol(data)
    const result = new Decoder(data.slice(16, data.length))
    if (proto.getStatus() !== Protocol.RESPONSE_STATUS.OK) {
      const exception = result.read()
      return cb(exception)
    }
    try {
      const flag = result.readInt()
      switch (flag) {
        case RESPONSE_NULL_VALUE:
          cb(null, null)
          break
        case RESPONSE_VALUE:
          cb(null, result.read())
          break
        case RESPONSE_WITH_EXCEPTION:
          let excep = result.read()
          !(excep instanceof Error) && (excep = new Error(excep))
          cb(excep)
          break
        default:
          cb(new Error(`Unknown result flag, expect '0' '1' '2', get ${flag}`))
      }
    } catch (err) {
      cb(err)
    }
  }
}

export { Decode }
