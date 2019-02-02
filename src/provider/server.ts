/**
 * Created by liuxi on 2019/02/01.
 */
import net = require('net')
import { Context } from './context'
import { EventEmitter } from 'events'
import { Socket } from '../../typings/provider'
import { Protocol } from '../common/protocol'

const debug = require('debug')('dubbo:provider:server')

const { PROTOCOL_LENGTH, HEART_BEAT_SERVER } = Protocol

class Server extends EventEmitter {
  ip: string
  port: number
  server: net.Server

  constructor (ip: string, port: number) {
    super()
    this.ip = ip
    this.port = port
    debug('开始创建服务socket')
    this.server = net.createServer()
    this.server.on('connection', this.serverConnection.bind(this))
    this.server.on('close', this.serverClose.bind(this))
    this.server.on('error', this.serverError.bind(this))
    debug('开始启动服务socket')
    this.server.listen(port, ip, () => {
      debug('服务socket启动完成')
      this.emit('done')
    })
  }

  ///////////////server/////////////
  serverConnection (socket: Socket) {
    debug(`consumer 连接 ${socket.remoteAddress}:${socket.remotePort}`)
    socket.buffer = Buffer.from([])
    socket.on('connect', this.clientConnect.bind(this, socket))
    socket.on('data', this.clientData.bind(this, socket))
    socket.on('end', this.clientEnd.bind(this, socket))
    socket.on('error', this.clientError.bind(this, socket))
    socket.on('close', this.clientClose.bind(this, socket))
  }

  serverClose () {
    debug('server 关闭')
  }

  serverError (error: Error) {
    debug('server 错误', error)
  }

  ///////////socket//////////
  clientConnect (socket: Socket) {
    debug('server consumer socket连接')
  }

  clientData (socket: Socket, data: Buffer) {
    socket.buffer = Buffer.concat([socket.buffer, data])
    this.decodeBuffer(socket)
  }

  clientEnd (socket: net.Socket) {
    debug('server consumer socket关闭')

  }

  clientError (socket: Socket, error: Error) {
    debug('server consumer socket 错误', error)

  }

  clientClose (socket: Socket, hasError: boolean) {
    debug('server consumer socket 关闭', hasError)

  }

  ///////////////decode///////////////////
  decodeBuffer (socket: Socket) {
    const data = socket.buffer
    if (data.length < PROTOCOL_LENGTH) {
      debug('server consumer 数据包太小缓存', data.length)
    }
    const proto = new Protocol(data)
    const length = proto.getBodyLength()
    if (data.length < length + PROTOCOL_LENGTH) {
      debug('server consumer 半包数据缓存', length)
    }

    if (proto.isHeartBeat()) {
      debug('server consumer 心跳包 响应心跳包')
      socket.buffer = socket.buffer.slice(PROTOCOL_LENGTH + length)
      socket.write(HEART_BEAT_SERVER)
      if (socket.buffer.length) {
        debug(`server consumer 还有数据包 继续解包`, socket.buffer.length)
        this.decodeBuffer(socket)
      }
      return
    }

    if (!proto.isRequest()) {
      debug('server consumer 数据包不是调用包 丢弃')
      socket.buffer = socket.buffer.slice(PROTOCOL_LENGTH + length)
      if (socket.buffer.length) {
        debug(`server consumer 还有数据包 继续解包`)
        this.decodeBuffer(socket)
      }
      return
    }

    const context = new Context(socket, data.slice(0, PROTOCOL_LENGTH + length))

    context.decode(() => {
      this.emit('invoke', context)
    })

    socket.buffer = socket.buffer.slice(PROTOCOL_LENGTH + length)
  }
}

export { Server }
