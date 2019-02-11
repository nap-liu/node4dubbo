/**
 * Created by liuxi on 2019/01/28.
 */

const MAGIC = [0xda, 0xbb]

const RESPONSE_STATUS: { [x: string]: number } = {
  OK: 0x14,
  CLIENT_TIMEOUT: 0x1e,
  SERVER_TIMEOUT: 0x1f,
  BAD_REQUEST: 0x28,
  BAD_RESPONSE: 0x32,
  SERVICE_NOT_FOUND: 0x3c,
  SERVICE_ERROR: 0x46,
  SERVER_ERROR: 0x50,
  CLIENT_ERROR: 0x5a
}

const RESPONSE_STATUS_CODE = Object.keys(RESPONSE_STATUS).map(k => RESPONSE_STATUS[k])

const TYPE_RESPONSE = 0x2
const TYPE_REQUEST = 0xc2

const MAX_ID = 9223372036854775807
const MAX_LEN = 1024 * 1024 * 8

const HEART_BEAT_CONSUMER = [
  ...MAGIC,
  0xe2, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0x01,
  0x4e
]

const HEART_BEAT_SERVER = [
  ...MAGIC,
  0x22,
  0x14,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0x01,
  0x4e
]

class Protocol {
  static PROTOCOL_LENGTH = 2 + 1 + 1 + 8 + 4

  static HEART_BEAT_CONSUMER = Buffer.from(HEART_BEAT_CONSUMER)

  static HEART_BEAT_SERVER = Buffer.from(HEART_BEAT_SERVER)

  static HEART_BEAT_LENGTH = Protocol.HEART_BEAT_CONSUMER.length

  static RESPONSE_WITH_EXCEPTION = 0
  static RESPONSE_VALUE = 1
  static RESPONSE_NULL_VALUE = 2

  static HEADER_INVOKE_RESPONSE = Buffer.from([
    ...MAGIC,
    0x02,
    0x14
  ])

  static HEADER_INVOKE = Buffer.from([
    ...MAGIC,
    0xc2,
    0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0
  ])

  static RESPONSE_STATUS = RESPONSE_STATUS

  data: Buffer

  constructor (data?: Buffer) {
    if (data) {
      this.data = data
    } else {
      this.data = Buffer.from(Protocol.HEADER_INVOKE)
    }
  }

  static isHeartBeat (data: Buffer) {
    return data.slice(Protocol.HEART_BEAT_LENGTH).equals(Protocol.HEART_BEAT_CONSUMER) ||
      data.slice(Protocol.HEART_BEAT_LENGTH).equals(Protocol.HEART_BEAT_SERVER)
  }

  toBuffer () {
    return this.data
  }

  isHeartBeat (): boolean {
    const data = this.data.slice(0, Protocol.HEART_BEAT_LENGTH)
    return data.equals(Protocol.HEART_BEAT_SERVER) || data.equals(Protocol.HEART_BEAT_CONSUMER)
  }

  isRequest () {
    return this.getType() === TYPE_REQUEST
  }

  isResponse () {
    if (this.getType() === TYPE_RESPONSE) {
      return RESPONSE_STATUS_CODE.indexOf(this.getStatus()) !== -1
    }
    return false
  }

  getType () {
    return this.data[2]
  }

  setType (data: number) {
    this.data[2] = data
  }

  getStatus () {
    return this.data[3]
  }

  setStatus (data: number) {
    this.data[3] = data
  }

  getBodyLength () {
    return this.data.readInt32BE(12)
  }

  setBodyLength (length: number) {
    if (length > MAX_LEN) {
      throw new Error(`Data length too large: ${length}, maximum payload: ${MAX_LEN}`)
    }
    return this.data.writeInt32BE(length, 12)
  }

  getInvokeId () {
    return this.data.readIntBE(4, 8)
  }

  setInvokeId (id: number) {
    if (id > MAX_ID) {
      throw new Error(`invoke id > MAX_ID: ${MAX_ID}`)
    }
    return this.data.writeIntBE(id, 4, 8)
  }
}

export { MAX_ID, MAX_LEN, Protocol }
