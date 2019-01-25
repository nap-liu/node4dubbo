/// <reference path="../typings/debug.d.ts" />
/**
 * Created by liuxi on 2019/01/18.
 */
import {EventEmitter} from 'events';
import * as _ from 'lodash';

const debug = require('debug')('dubbo:client:index');

import {DubboOption, service} from '../typings';
import Zookeeper, {DubboConsumer} from './zookeeper';
import Service from './service';
import {UrlWithParsedQuery} from "url";


/**
 * dubbo 客户端
 */
class DubboClient extends EventEmitter {
    [x: string]: Service | any;

    option: DubboOption;
    zk: Zookeeper;
    _dubboCunsumer: DubboConsumer;
    _ready: {
        [x: string]: {
            ready: boolean;
            resolve: Function[]
        }
    };


    constructor(option: DubboOption) {
        super();
        if (!option.address) {
            throw new Error('zookeeper address 不能为空');
        }

        if (!option.application) {
            throw new Error('zookeeper application 不能为空');
        }

        if (!option.path) {
            throw new Error('zookeeper path 路径不能为空');
        }
        if (!option.version) {
            throw new Error('dubbo version 不能为空');
        }

        this.option = _.merge({
            version: '2.5.3.6',
            sessionTimeout: 30000,
            spinDelay: 1000,
            retries: 5,
            pool: 2
        }, option);

        this._ready = Object.keys(option.services).reduce((map: any, name) => {
            map[name] = {
                ready: false,
                resolve: []
            };
            return map;
        }, {});

        this.initialZookeeper();
        this.registerConsumer();
    }

    registerConsumer() {
        debug('注册dubbo消费节点');
        this._dubboCunsumer = new DubboConsumer(this.zk, this.option, this);
    }

    initialZookeeper() {
        debug('开始连接zk');
        this.zk = new Zookeeper(this.option, this);
    }

    providerReady(serviceName: string, service: service, providers: UrlWithParsedQuery[]) {
        debug('找到 provider', providers.map(item => `${item.hostname}:${item.port} ${item.query.interface}@${item.query.version}`).join());
        service.dubboVersion = this.option.version;
        service.pool = this.option.pool;

        const matchedProviders = providers.filter(provider => {
            return (
                provider.query.group === service.group &&
                provider.query.version === service.version &&
                provider.protocol === 'dubbo:'
            )
        });

        if (matchedProviders.length === 0) {
            this.emit('error', new Error(`没有找到匹配的 ${serviceName} provider`), {
                service,
                serviceName,
                providers
            });
            return;
        }

        if (this[serviceName]) {
            debug(
                'provider 已经存在 diff 服务列表',
                matchedProviders.map(item => `${item.hostname}:${item.port} ${item.query.interface}@${item.query.version}`).join()
            );
            this[serviceName]._merge(service, matchedProviders);
        } else {
            debug(
                'provider 不存在 创建新服务',
                matchedProviders.map(item => `${item.hostname}:${item.port} ${item.query.interface}@${item.query.version}`).join()
            );
            this[serviceName] = new Service(serviceName, service, matchedProviders, this);
        }
    }

    async ready(service?: string) {
        const services = this.option.services;
        const serviceNames = Object.keys(services);
        if (service) {
            if (!services[service]) {
                throw new Error(`${service} service不存在 `)
            }
        } else if (serviceNames.length) {
            service = serviceNames[0];
        } else {
            throw new Error('该dubbo没有声明对应service');
        }

        let ready = this._ready[service];

        if (ready.ready) {
            return this;
        } else {
            return new Promise((resolve) => {
                ready.resolve.push(resolve);
            })
        }
    }
}

export {DubboClient};