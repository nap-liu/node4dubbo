/**
 * Created by liuxi on 2019/01/18.
 */
import {InvokePackage, Provider} from "../typings";
import net = require('net');
import decode from './decode'
import Encode from './encode';
import Service from './service'

const debug = require('debug')('dubbo:client:socket');

const HEADER_LENGTH = 16;
const FLAG_EVENT = 0x20;

class Socket {
    socket: net.Socket;
    invokePackage: InvokePackage;
    isBusy: boolean;
    heartBeatInter: NodeJS.Timeout;
    heartBeatLock: boolean;
    buffer: Buffer[];
    bufferLength: number;
    provider: Provider;
    service: Service;

    constructor(provider: Provider, service: Service) {
        const {hostname, port} = provider;

        this.provider = provider;
        this.isBusy = false;
        this.invokePackage = null;
        this.service = service;

        this.buffer = [];
        this.bufferLength = HEADER_LENGTH;

        this.socket = net.connect(+port, hostname);
        this.socket.on('close', this.close.bind(this));
        this.socket.on('data', this.data.bind(this));
        this.socket.on('error', this.error.bind(this));
        this.socket.on('connect', this.connect.bind(this));
        this.socket.on('timeout', this.timeout.bind(this));
        debug('开始建立点对点服务器socket连接', this.getInfo());
    }

    invoke(invokePackage: InvokePackage) {
        this.isBusy = true;
        this.heartBeatLock = true;
        this.invokePackage = invokePackage;
        const params = new Encode(invokePackage, this.provider);
        this.socket.write(params.toBuffer());
    }

    decodeBuffer(data: Buffer) {
        // 如果不是心跳事件则进行解析
        if (!((data[2] & FLAG_EVENT) !== 0)) {
            decode(data, (error: Error, result: any) => {
                if (this.invokePackage) {
                    if (error) {
                        this.invokePackage.reject(error)
                    } else {
                        this.invokePackage.resolve(result)
                    }
                }
                this.invokePackage = null;
                this.heartBeatLock = false;
                this.isBusy = false;
            })
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
                this.service._socketClose(this);
            }
            if (!this.socket.destroyed) {
                this.socket.destroy();
            }
            this.socket = null;
            this.invokePackage = null;
            this.isBusy = true;
            this.bufferLength = 0;
            this.buffer = null;
            this.provider = null;
            this.service = null;
            clearInterval(this.heartBeatInter);
        }
    }

    close(had_error: boolean) {
        debug('socket 关闭', this.getInfo());
        if (had_error && this.invokePackage && this.invokePackage.reject) {
            this.invokePackage.reject(new Error('socket 异常退出'));
        }
        this.clear()
    }

    error(error: Error) {
        debug('socket 错误', this.getInfo());
        if (this.invokePackage && this.invokePackage.reject) {
            this.invokePackage.reject(error);
        }
        this.clear()
    }

    data(data: Buffer) {
        // 第一个包读取总包长度
        if (this.buffer.length === 0) {
            this.bufferLength += data.readInt32BE(12);
        }
        this.buffer.push(data);
        const heap = Buffer.concat(this.buffer);
        if (heap.length === this.bufferLength) {
            this.bufferLength = HEADER_LENGTH;
            this.buffer = [];
            this.decodeBuffer(heap);
        }
    }


    connect() {
        debug('socket 连接成功 开始发送心跳', this.getInfo());
        this.heartBeatInter = setInterval(() => {
            if (!this.heartBeatLock) {
                // prettier-ignore
                this.socket.write(Buffer.from([0xda, 0xbb, 0xe2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01, 0x4e]))
            }
        }, 5000);
        this.isBusy = false;
    }


    timeout() {
        debug('socket 连接超时', this.getInfo());
        if (this.invokePackage && this.invokePackage.reject) {
            this.invokePackage.reject(new Error('socket 超时异常'));
        }
        this.clear();
    }
}


export default Socket