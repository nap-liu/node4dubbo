/// <reference path="../../typings/js-to-java.d.ts" />
/**
 * Created by liuxi on 2019/02/01.
 */
import java = require('js-to-java')

const Decoder = require('hessian.js').DecoderV2

import { Protocol } from '../common/protocol'
import { Socket } from '../../typings/provider'

const { PROTOCOL_LENGTH } = Protocol

class Context {
  buffer: Buffer
  socket: Socket
  interface: string
  version: string
  method: string
  args: any[]
  attachments: object

  constructor (socket: Socket, buffer: Buffer) {
    this.buffer = buffer
    this.socket = socket
  }

  decode (callback: Function) {
    const params: any[] = []
    const decode = new Decoder(this.buffer.slice(PROTOCOL_LENGTH))
    try {
      while (params.push(decode.read())) {
      }
    } catch (e) {
      let [
        dubboVersion,
        _interface,
        version,
        method,
        parameterTypes,
        ...args
      ] = params

      /**
       * 高版本dubbo多一个数据位
       */
      if (dubboVersion.startsWith('2.8')) {
        args.splice(4, 1)
      }

      const [attachments] = args.splice(args.length - 1, 1)

      this.interface = _interface
      this.version = version
      this.method = method
      this.args = args
      this.attachments = java.revert(attachments)
      callback()
    }
  }

  response (data: any) {
    const type = data

  }
}

export { Context }
