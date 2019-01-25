/**
 * Created by liuxi on 2019/01/18.
 */
const Decoder = require('hessian.js').DecoderV2;

const Response = {
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


const RESPONSE_WITH_EXCEPTION = 0;
const RESPONSE_VALUE = 1;
const RESPONSE_NULL_VALUE = 2;

class Decode {
    data: Buffer;

    constructor(data: Buffer) {
        this.data = data;
    }

    readResult(cb: Function) {
        const {data} = this;
        const result = new Decoder(data.slice(16, data.length));
        if (data[3] !== Response.OK) {
            return cb(result.readString())
        }
        try {
            const flag = result.readInt();

            switch (flag) {
                case RESPONSE_NULL_VALUE:
                    cb(null, null);
                    break;
                case RESPONSE_VALUE:
                    cb(null, result.read());
                    break;
                case RESPONSE_WITH_EXCEPTION:
                    let excep = result.read();
                    !(excep instanceof Error) && (excep = new Error(excep));
                    cb(excep);
                    break;
                default:
                    cb(new Error(`Unknown result flag, expect '0' '1' '2', get ${flag}`))
            }
        } catch (err) {
            cb(err)
        }
    }

    readId() {
        return this.data.readIntBE(4, 8);
    }
}

export default Decode;