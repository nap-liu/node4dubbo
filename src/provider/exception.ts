/**
 * Created by liuxi on 2019/02/03.
 */
import { Protocol } from '../common/protocol'

class Exception extends Error {
  code: number

  constructor (message: string, code: number = Protocol.RESPONSE_STATUS.SERVER_ERROR) {
    super(message)
    this.code = code
  }

  getCode () {
    return this.code
  }
}

class ClientTimeout extends Exception {
  constructor (message: string) {
    super(message, Protocol.RESPONSE_STATUS.CLIENT_TIMEOUT)
  }
}

class ServerTimeout extends Exception {
  constructor (message: string) {
    super(message, Protocol.RESPONSE_STATUS.SERVER_TIMEOUT)
  }
}

class BadRequest extends Exception {
  constructor (message: string) {
    super(message, Protocol.RESPONSE_STATUS.BAD_REQUEST)
  }
}

class BadResponse extends Exception {
  constructor (message: string) {
    super(message, Protocol.RESPONSE_STATUS.BAD_RESPONSE)
  }
}

class ServiceNotFound extends Exception {
  constructor (message: string) {
    super(message, Protocol.RESPONSE_STATUS.SERVICE_NOT_FOUND)
  }
}

class ServiceError extends Exception {
  constructor (message: string) {
    super(message, Protocol.RESPONSE_STATUS.SERVICE_ERROR)
  }
}

class ServerError extends Exception {
  constructor (message: string) {
    super(message, Protocol.RESPONSE_STATUS.SERVER_ERROR)
  }
}

class ClientError extends Exception {
  constructor (message: string) {
    super(message, Protocol.RESPONSE_STATUS.CLIENT_ERROR)
  }
}

export {
  ClientTimeout,
  ServerTimeout,
  BadRequest,
  BadResponse,
  ServiceNotFound,
  ServiceError,
  ServerError,
  ClientError
}
