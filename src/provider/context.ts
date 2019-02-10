/// <reference path="../../typings/js-to-java.d.ts" />
/**
 * Created by liuxi on 2019/02/01.
 */
import java = require('js-to-java')

const Decoder = require('hessian.js').DecoderV2
const Encoder = require('hessian.js').EncoderV2

import { Protocol } from '../common/protocol'
import { Socket } from '../../typings/provider'
import {
  BadRequest,
  BadResponse,
  ClientError,
  ClientTimeout,
  ServerError,
  ServerTimeout,
  ServiceError,
  ServiceNotFound
} from './exception'

const { PROTOCOL_LENGTH } = Protocol

class Context {
  buffer: Buffer
  socket: Socket
  interface: string
  version: string
  method: string
  args: any[]
  attachments: object
  request: Protocol
  result: any

  constructor (socket: Socket, buffer: Buffer, request: Protocol) {
    this.buffer = buffer
    this.socket = socket
    this.request = request
    this.result = null
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

  response = () => {
    const { result } = this
    const encode = new Encoder()
    const proto = new Protocol(
      Buffer.concat([
        Buffer.from(Protocol.HEADER_INVOKE_RESPONSE),
        Buffer.from(Array.from({ length: PROTOCOL_LENGTH - 4 }))
      ])
    )

    proto.setInvokeId(this.request.getInvokeId())

    if (result instanceof Error) {
      // 如果错误是定义类型的话则直接返回错误信息
      if (
        result instanceof ServiceNotFound ||
        result instanceof ServerTimeout ||
        result instanceof BadRequest ||
        result instanceof ServiceError ||
        result instanceof ServerError
      ) {
        proto.setStatus(result.getCode()) // 写入错误类型
        encode.write(java.exception(result)) // 写入错误信息
      } else {
        // 如果错误不是定义错误的话 则按照正常返回返回错误信息
        proto.setStatus(Protocol.RESPONSE_STATUS.OK)
        encode.write(Protocol.RESPONSE_WITH_EXCEPTION)
        encode.write(java.exception(result))
      }
    } else {
      if (result == null) {
        encode.write(Protocol.RESPONSE_NULL_VALUE)
      } else {
        encode.write(Protocol.RESPONSE_VALUE)
        encode.write(result)
      }
    }

    const buffer = encode.get()
    proto.setBodyLength(buffer.length)
    this.socket.write(Buffer.concat([proto.toBuffer(), buffer]))
  }
}

export { Context }
