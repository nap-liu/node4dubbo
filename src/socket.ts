/**
 * Created by liuxi on 2019/01/18.
 */
import {InvokePackage, Provider} from "../typings";
import net = require('net');
import Decode from './decode'
import Encode from './encode';
import Service from './service';
import Protocol, {MAX_ID} from './protocol';

const debug = require('debug')('dubbo:client:socket');

const {PROTOCOL_LENGTH} = Protocol;

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
    wait: InvokePackage[];
    taskCount: number;

    constructor(provider: Provider, service: Service) {
        const {hostname, port} = provider;

        this.provider = provider;
        this.service = service;
        this.buffer = Buffer.from([]);
        this.id = 0;
        this.tasks = {};
        this.taskCount = 0;
        this.wait = [];

        this.socket = net.connect(+port, hostname);
        this.socket.on('close', this.close.bind(this));
        this.socket.on('data', this.data.bind(this));
        this.socket.on('error', this.error.bind(this));
        this.socket.on('connect', this.connect.bind(this));
        this.socket.on('timeout', this.timeout.bind(this));
        debug('开始建立点对点服务器socket连接', this.getInfo());
    }

    invoke(invokePackage: InvokePackage): Promise<void> {
        return new Promise((resolve) => {
            if (this.taskCount >= +this.provider.query['default.executes']) {
                invokePackage.startInvoke = resolve;
                this.wait.push(invokePackage);
                debug('并发数超过最大值 缓存到队列');
                return;
            }

            this.taskCount++;
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
            resolve();
        });
    }

    cancel(invokePackage: InvokePackage) {
        delete this.tasks[invokePackage.id];
    }

    decodeBuffer() {
        const data = this.buffer;
        if (data.length < PROTOCOL_LENGTH) {
            debug('分包太小缓存buffer');
            return
        }

        const proto = new Protocol(data);
        const length = proto.getBodyLength();

        if (data.length < PROTOCOL_LENGTH + length) {
            debug('缓存buffer');
            return;
        }

        if (proto.isHeartBeat()) {
            this.buffer = this.buffer.slice(PROTOCOL_LENGTH + length);
            debug('心跳包 跳过');
            return;
        }


        if (!proto.isResponse()) {
            const drop = this.buffer.slice(0, PROTOCOL_LENGTH + length);
            this.buffer = this.buffer.slice(PROTOCOL_LENGTH + length);
            debug('不是调用返回包 丢弃', drop);
            return;
        }

        const decode = new Decode(data);
        const id = proto.getInvokeId();
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
                this.execWaitTask();
                debug('dubbo 解包完成 移除任务', id, length);
            });
        } else {
            debug('dubbo 结果丢弃', id, length);
        }

        this.buffer = this.buffer.slice(PROTOCOL_LENGTH + length);

        if (this.buffer.length) {
            debug('粘包 继续解包');
            this.decodeBuffer();
        }
    }

    /**
     * 执行缓存队列里面的任务
     */
    execWaitTask() {
        this.taskCount--;
        if (this.wait.length) {
            debug('执行缓存队列任务');
            const task = this.wait.shift();
            task.startInvoke();
            this.invoke(task);
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
        this.buffer = Buffer.concat([this.buffer, data]);
        this.decodeBuffer();
    }


    connect() {
        debug('socket 连接成功 开始发送心跳', this.getInfo());
        this.heartBeatInter = setInterval(() => {
            if (this.buffer.length) {
                debug('dubbo 当前有活动方法 暂停心跳');
            } else {
                this.socket.write(Protocol.HEART_BEAT_SEND)
            }
        }, 1000 * 5);
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
