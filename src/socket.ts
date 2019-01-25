/**
 * Created by liuxi on 2019/01/18.
 */
import {InvokePackage, Provider} from "../typings";
import net = require('net');
import Decode from './decode'
import Encode from './encode';
import Service from './service'

const debug = require('debug')('dubbo:client:socket');

const HEADER_LENGTH = 16;
const MAX_ID = 9223372036854775807;
const HEART_BEAT_SEND = Buffer.from([0xda, 0xbb, 0xe2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01, 0x4e]);
const HEART_BEAT_RECEIVE = Buffer.from([0xda, 0xbb, 0x22, 0x14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01, 0x4e]);
const HEADE_INVOKE_RESPONSE = Buffer.from([0xda, 0xbb, 0x02, 0x14]);

class Socket {
    socket: net.Socket;
    heartBeatInter: NodeJS.Timeout;
    provider: Provider;
    service: Service;
    id: number;
    tasks: {
        [x: string]: InvokePackage;
    };
    buffer: Buffer;

    constructor(provider: Provider, service: Service) {
        const {hostname, port} = provider;

        this.provider = provider;
        this.service = service;
        this.buffer = Buffer.from([]);
        this.id = 0;
        this.tasks = {};

        this.socket = net.connect(+port, hostname);
        this.socket.on('close', this.close.bind(this));
        this.socket.on('data', this.data.bind(this));
        this.socket.on('error', this.error.bind(this));
        this.socket.on('connect', this.connect.bind(this));
        this.socket.on('timeout', this.timeout.bind(this));
        debug('开始建立点对点服务器socket连接', this.getInfo());
    }

    invoke(invokePackage: InvokePackage) {
        while (this.tasks[this.id]) {
            this.id++;
            if (this.id >= MAX_ID) {
                this.id = 0;
            }
        }

        invokePackage.id = this.id;
        this.tasks[this.id] = invokePackage;
        const params = new Encode(invokePackage, this.provider);
        this.socket.write(params.toBuffer());
    }

    cancel(invokePackage: InvokePackage) {
        delete this.tasks[invokePackage.id];
    }

    decodeBuffer() {
        const data = this.buffer;
        if (data.length < HEADER_LENGTH) {
            debug('分包太小缓存buffer');
            return
        }
        const length = data.readInt32BE(12) + HEADER_LENGTH;

        if (data.length < length) {
            debug('缓存buffer');
            return;
        }

        const decode = new Decode(data);
        const id = decode.readId();
        const invokePackage = this.tasks[id];

        if (invokePackage) {
            decode.readResult((error: Error, result: any) => {
                if (invokePackage) {
                    try {
                        if (error) {
                            invokePackage.reject(error)
                        } else {
                            invokePackage.resolve(result)
                        }
                    } catch (e) {
                        debug('dubbo 回调出错', e);
                    }
                }
                delete this.tasks[id];
                debug('dubbo 解包完成 移除任务', id, length)
            });
        } else {
            debug('dubbo 结果丢弃', id, length);
        }

        let next = data.slice(length);
        this.buffer = next;

        if (data.length > length) {
            debug('dubbo socket沾包 拆包', id, length);
            const headLength = HEART_BEAT_RECEIVE.length;
            let head = next.slice(0, headLength);
            while (HEART_BEAT_RECEIVE.equals(head)) {
                debug('移除心跳包', id);
                next = next.slice(headLength);
                head = next.slice(0, headLength);
            }
            if (next.length > headLength && next.length >= next.readInt32BE(12) + HEADER_LENGTH) {
                this.buffer = next;
                this.decodeBuffer();
            } else {
                debug('dubbo 沾包数据包不完整', id, length, next.length, next);
            }
        }

    }

    getInfo(): string {
        if (this.provider) {
            return `${this.provider.hostname}:${this.provider.port} ${this.provider.query.interface}`;
        }
        return '';
    }

    /**
     * 清理socket连接
     * @param {boolean} noticeParent 是否通知父级 默认通知
     */
    clear(noticeParent: boolean = true) {
        if (this.socket) {
            if (noticeParent) {
                this.service._socketClose(this.provider);
            }
            if (!this.socket.destroyed) {
                this.socket.destroy();
            }
            this.socket = null;
            this.provider = null;
            this.service = null;
            this.tasks = null;
            this.buffer = null;
            clearInterval(this.heartBeatInter);
        }
    }

    close(had_error: boolean) {
        debug('socket 关闭', this.getInfo());
        if (had_error) {
            Object.keys(this.tasks).forEach(id => {
                const invokePackage = this.tasks[id];
                invokePackage.reject(new Error('socket 异常退出'));
            });
        }
        this.clear()
    }

    error(error: Error) {
        debug('socket 错误', this.getInfo());
        Object.keys(this.tasks).forEach(id => {
            const invokePackage = this.tasks[id];
            invokePackage.reject(error);
        });
        this.clear()
    }

    data(data: Buffer) {
        if (!data.equals(HEART_BEAT_RECEIVE)) {
            this.buffer = Buffer.concat([this.buffer, data]);
            this.decodeBuffer();
        } else {
            debug('dubbo 心跳包')
        }
    }


    connect() {
        debug('socket 连接成功 开始发送心跳', this.getInfo());
        this.heartBeatInter = setInterval(() => {
            if (this.buffer.length) {
                debug('dubbo 当前有活动方法 暂停心跳');
            } else {
                this.socket.write(HEART_BEAT_SEND)
            }
        }, 5000);
        this.provider.retryCount = 1;
    }

    timeout() {
        debug('socket 连接超时', this.getInfo());
        Object.keys(this.tasks).forEach(id => {
            const invokePackage = this.tasks[id];
            invokePackage.reject(new Error('socket 超时异常'));
        });
        this.clear();
    }
}


export default Socket