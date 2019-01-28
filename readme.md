# dubbo for nodejs

该模块参考了 [node-zookeeper-dubbo](https://www.npmjs.com/package/node-zookeeper-dubbo) 模块

**CHANGE.LOG**

* 2019-01-28
  * 修复并发数高出最大并发数的bug
  * 修改解码流程

* 2019-01-25 
  * 修改默认连接池数量为 2
  * 重构调用策略同等数量调用，效率提升了4倍左右

**附加库**
* [js-to-java](https://www.npmjs.com/package/js-to-java) 数据转换库

#### 模块特性
  * 本地api `Promise`形式接口调用 自动维护超时时间
  * 点对点`socket`连接 内部自动维护`socket`连接池
  * 自动维护`zookeeper`连接状态
  * `event` 形式通知内部状态
  * `ready` 方法等待`dubbo`初始化完成

---

+ [安装](#安装)
+ [例子](#例子)
+ [文档](#文档)
    + [new DubboClient](#DubboClient)
        + [ready](#ready)
        + [event](#event)
 

## 安装
```bash
npm install dubbo4node --save
```

## 例子

```javascript
const {DubboClient} = require('dubbo4node')

// 注册dubbo客户端
const remoteDubbo = new DubboClient({
  application: 'your app name',
  address: 'zookeeper address',
  path: 'dubbo',
  version: '1.1.3',

  services: {
    Remote: {
      interface: 'com.remote.Remote',
      version: '1.0',
      methods: {
        func1: [
          (param, java) => java('com.remote.params.Remote', param)
        ]
      }
    }
  }
})

// 等待dubbo服务初始化完成 调用dubbo接口
remoteDubbo.ready().then(() => {
  return remoteDubbo.Remote.func1({
    test: 1
  })
}).then(res => {
  console.log(res)
}).catch(e => {
  console.log(e)
})

```

## 文档

### DubboClient

客户端构造函数 用于创建一个dubbo客户端

**option**

* path `string` dubbo服务在zookeeper中注册的命名空间
* version `string` dubbo版本
* application `string` 本地客户端名称
* address `string` zookeeper服务地址
* pool `number` 内部线程池数量 默认 2
* services `object` 声明使用的dubbo接口
* services.remote.interface `string` dubbo公开接口
* services.remote.version `string` dubbo接口版本
* services.remote.token `string` 是否启用token验证 可选
* services.remote.attachments `object | function` 接口上下文变量 可选
* services.remote.group `string` 接口分组 可选
* services.remote.methods `object` dubbo接口参数转义声明 可选
* services.remote.methods.fun1 `array` 参数转义函数数组



**示例**
```javascript
const dubbo = new DubboClient({
    application: 'my_dubbo',
    version: '1.1.3',
    address: '127.0.0.1:2181',
    services: {
        remote: {
            interface: 'com.remote.Remote',
            version: '1.0',
            token: 'true',
            group: 'test',
            attachments: {
                xxx: '1'
            },
            methods: {
                fun1: [
                    // 长度视参数数量决定 第一个是参数值 第二个是js-to-java数据转换库
                    (param, java) => java.String(param)
                ]
            }
        }
    }
});

// 直接调用即可
dubbo.remote.fun1('arg1').then(res => {

}).catch(e => {

})

```

---

#### ready(serviceName?: string)

很多场景需要启动就调用某个函数 所以提供了此函数

**示例**

```javascript
// 单个interface使用
dubbo.ready().then((dubbo) => {
  return dubbo.remote.fun1('arg1')
})

// 指定interface
dubbo.ready('remote').then((dubbo) => {
  return dubbo.remote.fun1('arg1')
})

```

---

#### event

事件回调中提供了内部状态改变的通知 包含 zookeeper、socket、内部状态

* `error` zookeeper 连接出错、连接断开、认证失败、获取节点出错、创建客户端出错
* `zookeeper-node-change` zookeeper 上注册的dubbo服务节点变化
* `dubbo-socket-retry` socket 连接异常重试连接服务
* `dubbo-server-merge` dubbo 节点变更合并新旧服务节点
* `dubbo-ready` dubbo 服务初始化完成可以使用对应的服务

**示例**

```javascript
/**
 * zookeeper 连接状态不正常回调
 */
dubbo.on('error', (error, option) => {

})

/**
 * dubbo 在zookeeper上注册的节点变化
 */
dubbo.on('zookeeper-node-change', (option) => {

})

/**
 * provider socket 异常断开 重试连接
 */
dubbo.on('dubbo-socket-retry', (provider) => {

})

/**
 * newServices 新的server列表
 * mergedServices 合并后的server列表
 */
dubbo.on('dubbo-server-merge', (newServices, mergedServices) => {

})

/**
 * dubbo 实例
 * service 初始化完毕的service
 */
dubbo.on('dubbo-ready', (dubbo, service) => {

})


```


