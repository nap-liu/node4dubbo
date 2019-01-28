/**
 * Created by liuxi on 2019/01/28.
 */

const MAGIC = [0xda, 0xbb];

const RESPONSE_STATUS = {
    OK: 20,
    CLIENT_TIMEOUT: 30,
    SERVER_TIMEOUT: 31,
    BAD_REQUEST: 40,
    BAD_RESPONSE: 50,
    SERVICE_NOT_FOUND: 60,
    SERVICE_ERROR: 70,
    SERVER_ERROR: 80,
    CLIENT_ERROR: 90
};

const MAX_ID = 9223372036854775807;
const MAX_LEN = 1024 * 1024 * 8;

class Protocol {
    static PROTOCOL_LENGTH = 2 + 1 + 1 + 8 + 4;

    static HEART_BEAT_SEND = Buffer.from([
        ...MAGIC,
        0xe2, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0x01,
        0x4e
    ]);

    static HEART_BEAT_RECEIVE = Buffer.from([
        ...MAGIC,
        0x22,
        0x14,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0x01,
        0x4e
    ]);

    static HEART_BEAT_LENGTH = Protocol.HEART_BEAT_RECEIVE.length;

    static HEADER_INVOKE_RESPONSE = Buffer.from([
        ...MAGIC,
        0x02,
        0x14,
    ]);

    static HEADER_INVOKE = Buffer.from([
        ...MAGIC,
        0xc2,
        0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0
    ]);

    static RESPONSE_STATUS = RESPONSE_STATUS;

    data: Buffer;

    constructor(data?: Buffer) {
        if (data) {
            this.data = data;
        } else {
            this.data = Buffer.from(Protocol.HEADER_INVOKE);
        }
    }

    static isHeartBeat(data: Buffer) {
        return data.slice(Protocol.HEART_BEAT_LENGTH).equals(Protocol.HEART_BEAT_RECEIVE) ||
            data.slice(Protocol.HEART_BEAT_LENGTH).equals(Protocol.HEART_BEAT_SEND)
    }

    toBuffer() {
        return this.data;
    }

    isHeartBeat(): boolean {
        const data = this.data.slice(0, Protocol.HEART_BEAT_LENGTH);
        return data.equals(Protocol.HEART_BEAT_RECEIVE) || data.equals(Protocol.HEART_BEAT_SEND)
    }

    isResponse() {
        const data = this.data.slice(0, Protocol.HEADER_INVOKE_RESPONSE.length);
        return data.equals(Protocol.HEADER_INVOKE_RESPONSE);
    }

    getType() {
        return this.data[2];
    }

    getStatus() {
        return this.data[3];
    }

    getBodyLength() {
        return this.data.readInt32BE(12);
    }

    setBodyLength(length: number) {
        if (length > MAX_LEN) {
            throw new Error(`Data length too large: ${length}, maximum payload: ${MAX_LEN}`);
        }
        return this.data.writeInt32BE(length, 12);
    }

    getInvokeId() {
        return this.data.readIntBE(4, 8);
    }

    setInvokeId(id: number) {
        if (id > MAX_ID) {
            throw new Error(`invoke id > MAX_ID: ${MAX_ID}`)
        }
        return this.data.writeIntBE(id, 4, 8);
    }
}

export {MAX_ID, MAX_LEN};
export default Protocol
