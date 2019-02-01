/**
 * Created by liuxi on 2019/02/01.
 */
import net = require('net')
import { Context } from './context'
import { EventEmitter } from 'events'
import { Socket } from '../../typings/provider'

const debug = require('debug')('dubbo:provider:server')

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
    debug('server 新client socket连接')
  }

  clientData (socket: Socket, data: Buffer) {
    socket.buffer = Buffer.concat([socket.buffer, data])

  }

  clientEnd (socket: net.Socket) {
    debug('server client socket关闭')

  }

  clientError (socket: Socket, error: Error) {
    debug('server client socket 错误', error)

  }

  clientClose (socket: Socket, hasError: boolean) {
    debug('server client socket 关闭', hasError)

  }

  reply (context: Context) {

  }

}

export { Server }
