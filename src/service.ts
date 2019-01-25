/**
 * Created by liuxi on 2019/01/18.
 */
import {DubboOption, InvokePackage, Provider, service} from "../typings";
import {UrlWithParsedQuery} from "url";
import Socket from './socket';
import java = require('js-to-java');
import {DubboClient} from './index'
import * as _ from 'lodash';

const debug = require('debug')('dubbo:client:service');

class Service {
    [x: string]: Function | any;

    _service: service;
    _providers: Provider[];
    _parent: DubboClient;
    _name: string;
    _index: number;

    constructor(serviceName: string, service: service, providers: UrlWithParsedQuery[], dubbo: DubboClient) {
        this._parent = dubbo;
        this._service = service;
        this._name = serviceName;
        this._tasks = [];
        this._index = 0;

        this._providers = providers.reduce((pool: Provider[], current: Provider) => {
            let currentPool: number = service.pool;
            while (currentPool--) {
                pool.push(_.clone(current));
            }
            return pool
        }, []).map((provider: Provider) => {
            provider.socket = new Socket(provider, this);
            provider.retryCount = 1;
            return provider;
        });
        debug('创建dubbo线程池', this._providers.length);
        debug('注入实例方法', this._service.interface);
        this._injectInvokeProxy();
        process.nextTick(this._ready.bind(this));
    }

    _ready() {
        debug('服务初始化完成', this._service.interface);
        this._emit('dubbo-ready', this._parent, this._service);
        if (this._parent && this._parent._ready && this._parent._ready[this._name]) {
            const ready = this._parent._ready[this._name];
            ready.ready = true;
            ready.resolve.forEach(item => {
                item(this._parent);
            });
            ready.resolve = []
        }
    }

    /**
     * 使用父元素的event通知外部状态
     * @param {string | symbol} event
     * @param args
     * @private
     */
    _emit(event: string | symbol, ...args: any[]) {
        if (this._parent) {
            this._parent.emit(event, ...args);
        }
    }

    /**
     * 注册代理方法
     * @private
     */
    _injectInvokeProxy() {
        const allMethods: Map<string, Provider> = new Map();
        this._providers.forEach(provider => {
            const {methods} = provider.query;
            (methods as string).split(',').forEach((item: string) => {
                allMethods.set(item, provider);
            })
        });
        allMethods.forEach((provider: Provider, method) => {
            this[method] = this._invoke(method, provider);
        })

    }

    /**
     * 调用远程dubbo方法
     * @param {string} method
     * @param {Provider} provider
     * @returns {(...args: any[]) => Promise<any>}
     * @private
     */
    _invoke(method: string, provider: Provider) {
        return (...args: any[]) => {
            const {_service} = this;
            const {methods} = _service;
            if (methods && methods[method] && methods[method].length) {
                args = args.map((param, index) => {
                    const func = methods[method][index] || (param => param);
                    return func(param, java);
                })
            }
            return new Promise(async (resolve, reject) => {
                this._getProvider((provider: Provider) => {
                    const invoker = {
                        resolve,
                        reject,
                        method,
                        args,
                        service: _service
                    };
                    provider.socket.invoke(invoker);
                    setTimeout(() => {
                        try {
                            reject(new Error(`${_service.interface}.${method} 调用超时`))
                        } catch (e) {
                            debug('回调业务出错', e)
                        }
                        provider.socket.cancel(invoker);
                    }, +provider.query['default.timeout'] || 1000 * 5)
                });
            })
        }
    }

    /**
     * 从线程池中选取空闲的线程执行dubbo调用
     * @returns {Promise<Provider>}
     * @private
     */
    _getProvider(callback: Function) {
        if (this._providers.length) {
            callback(this._providers[this._index++]);
            if (this._index >= this._providers.length) {
                this._index = 0;
            }
        } else {
            throw new Error(`interface ${this._service.interface} 没有提供 provider`);
        }
    }

    /**
     * 删除指定socket连接池
     * @param {string} host
     * @param {string} port
     * @private
     */
    _closeProviderByHost(host: string, port: string) {
        if (Array.isArray(this._providers)) {
            const dels: number[] = [];

            this._providers.forEach((item: Provider, index: number) => {
                if (item.hostname === host && item.port === port) {
                    item.socket.clear(false);
                    dels.push(index);
                }
            });

            dels.reverse().forEach(item => {
                this._providers.splice(item, 1);
            });
        }
    }

    /**
     * 手动关闭 service 释放相关内存
     * @private
     */
    _close() {
        if (Array.isArray(this._providers)) {
            this._providers.forEach((item: Provider, index: number) => {
                item.socket.clear(false);
            });

            this._providers = null;
            this._parent = null;
            this._service = null;
            Object.keys(this).forEach(key => {
                delete this[key];
            });
        }
    }

    /**
     * socket异常断开 重连服务
     * @param {Provider} provider
     * @private
     */
    _socketClose(provider: Provider) {
        if (provider.retryCount === 1) {
            provider.retryCount += 1;
        } else {
            provider.retryCount *= provider.retryCount;
        }
        debug(
            '线程池socket异常断开 开始重试',
            `${provider.hostname}:${provider.port} ${provider.query.interface}@${provider.query.version}`,
        );
        setTimeout(() => {
            this._emit('dubbo-socket-retry', provider);
            provider.socket = new Socket(provider, this);
        }, 1000 * provider.retryCount);
    }

    /**
     * 新老service合并
     * @param service
     * @param children
     * @private
     */
    _merge(service: service, children: UrlWithParsedQuery[]) {
        const newLinks: Provider[] = children.filter(provider => {
            return this._providers.findIndex(item => item.hostname === provider.hostname && item.port === provider.port) === -1;
        }) as Provider[];

        const removeLinks: Provider[] = this._providers.filter(provider => {
            return children.findIndex(item => item.hostname === provider.hostname && item.port === provider.port) === -1;
        });


        removeLinks.forEach(item => {
            this._closeProviderByHost(item.hostname, item.port);
        });

        debug(
            'service provider 变化 diff 新老 provider 新建provider',
            newLinks.length,
            newLinks.map(item => `${item.hostname}:${item.port} ${item.query.interface}@${item.query.version}`).join()
        );
        debug(
            'service provider 变化 diff 新老 provider 移除provider',
            removeLinks.length,
            removeLinks.map(item => `${item.hostname}:${item.port} ${item.query.interface}@${item.query.version}`).join()
        );

        debug('service provider 老provider数量', this._providers.length);
        this._service = service;

        // 重新生成新的prodiver线程池
        this._providers = [
            ...this._providers,
            // 生成新线程池
            ...newLinks.reduce((pool: Provider[], current: Provider) => {
                let currentPool: number = service.pool;
                while (currentPool--) {
                    pool.push(_.clone(current));
                }
                return pool
            }, []).map((provider: Provider) => {
                provider.socket = new Socket(provider, this);
                return provider;
            })
        ];
        debug('service provider 新provider数量', this._providers.length);

        this._injectInvokeProxy();
        this._emit('dubbo-server-merge', children, this._providers);
    }

}


export default Service;