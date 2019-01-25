/**
 * Created by liuxi on 2019/01/18.
 */
import {attachmentsFunction, InvokePackage, Provider} from "../typings";

const Encoder = require('hessian.js').EncoderV2;
const MAX_LEN = 8388608; // 8 * 1024 * 1024, default maximum length of body


class Encode {
    invoke: InvokePackage;
    provider: Provider;

    constructor(invoke: InvokePackage, provider: Provider) {
        this.invoke = invoke;
        this.provider = provider;
    }

    toBuffer(): Buffer {
        const body = this.body();
        const head = this.head(body.length);
        return Buffer.concat([head, body])
    }

    head(length: number): Buffer {
        const head = Buffer.from([0xda, 0xbb, 0xc2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        if (length > MAX_LEN) {
            throw new Error(`Data length too large: ${length}, maximum payload: ${MAX_LEN}`);
        }
        head.writeInt32BE(length, 12);
        head.writeIntBE(this.invoke.id, 4, 8);
        return head
    }

    body(): Buffer {
        const {method, args, service} = this.invoke;
        const body = new Encoder();
        body.write(service.dubboVersion);

        body.write(service.interface);
        body.write(service.version);
        body.write(method);

        if (service.dubboVersion.startsWith('2.8')) {
            body.write(-1) // for dubbox 2.8.X
        }

        body.write(this.argsType(args));
        if (args && args.length) {
            for (let i = 0, len = args.length; i < len; ++i) {
                body.write(args[i])
            }
        }
        body.write(this.attachments());
        return body.byteBuffer._bytes.slice(0, body.byteBuffer._offset)
    }

    attachments(): object {
        const {pathname, query} = this.provider;
        const {interface: _interface, version, group, token, attachments} = this.invoke.service;

        const implicitArgs: { [x: string]: string } = {
            interface: _interface,
            path: pathname.slice(1),
            timeout: query['default.timeout'] as string,
            version,
            group,
            token
        };

        const type = typeof attachments;
        if (type === 'function') {
            const attach: object = (attachments as attachmentsFunction)(this.invoke);
            Object.assign(implicitArgs, attach)
        } else if (!Array.isArray(attachments) && type === 'object') {
            Object.assign(implicitArgs, attachments);
        }

        /**
         * 排除不存在的key
         */
        Object.keys(implicitArgs).forEach(key => {
            if (!implicitArgs[key]) {
                delete implicitArgs[key]
            }
        });

        return {
            $class: 'java.util.HashMap',
            $: implicitArgs
        }
    }

    argsType(args: any[]) {
        if (!(args && args.length)) {
            return '';
        }

        const typeRef: { [x: string]: string } = {
            boolean: 'Z',
            int: 'I',
            short: 'S',
            long: 'J',
            double: 'D',
            float: 'F'
        };

        let parameterTypes = '';
        let type;

        for (let i = 0, l = args.length; i < l; i++) {
            type = args[i]['$class'];

            if (type.charAt(0) === '[') {
                parameterTypes += ~type.indexOf('.')
                    ? '[L' + type.slice(1).replace(/\./gi, '/') + ';'
                    : '[' + typeRef[type.slice(1)];
            } else {
                parameterTypes += type && ~type.indexOf('.') ? 'L' + type.replace(/\./gi, '/') + ';' : typeRef[type];
            }
        }

        return parameterTypes;
    }
}

export default Encode;
