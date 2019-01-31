/**
 * Created by liuxi on 2019/01/18.
 */
import {attachmentsFunction, InvokePackage, Provider} from "../../typings/consumer";
import Protocol from './protocol';

const Encoder = require('hessian.js').EncoderV2;

class Encode {
    invoke: InvokePackage;
    provider: Provider;

    constructor(invoke: InvokePackage, provider: Provider) {
        this.invoke = invoke;
        this.provider = provider;
    }

    toBuffer(): Buffer {
        const body = this.body();
        const head = new Protocol();
        head.setBodyLength(body.length);
        head.setInvokeId(this.invoke.id);
        return Buffer.concat([head.toBuffer(), body])
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
