# dubbo for nodejs

该模块参考了 [node-zookeeper-dubbo](https://www.npmjs.com/package/node-zookeeper-dubbo) 模块

**CHANGE.LOG**

* 2019-02-11
  * 增加provider能力 用于给外部提供服务
  * 修复consumer provider不自动热替换服务的问题

* 2019-01-30
  * 移除对单provider线程池 保证高并发执行稳定
  * 限制对单provider最大并发数为总并发数的一半
  * 修复兜底超时回调可能会导致并发数错误问题
  * 修复超时回调可能访问异常的问题
  

* 2019-01-29
  * 修复调用异常错误处理超时

* 2019-01-28
  * 修复并发数高出最大并发数的bug
  * 修复socket关闭后回调访问属性出错
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
    + [new Consumer](#Consumer)
        + [ready](#ready(servicename?:-string))
        + [event](#consumer-event)
    + [new Provider](#Provider)
        + [addService](#addservice)
        + [use](#use)
        + [start](#start(callback?:-function))
        + [event](#provider-event)
    + [new Service](#Service)
        + [method](#method(name:-string,-...functions:-function[]))
    + [Context](#Context)
        
 

## 安装
```bash
npm install dubbo4node --save
```

## 例子

```javascript
const {Consumer} = require('dubbo4node')

// 注册dubbo客户端
const remoteDubbo = new Consumer({
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

### Consumer

客户端构造函数 用于创建一个dubbo客户端

**参数**

* path `string` dubbo服务在zookeeper中注册的命名空间
* version `string` dubbo版本
* application `string` 本地客户端名称
* address `string` zookeeper服务地址
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
const dubbo = new Consumer({
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
})

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

#### <span id="consumer-event">event<span>

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
  // 如果不处理此事件的话 会导致consumer进程直接退出
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

## 例子
```javascript
const {Provider, Service} = require('dubbo4node')

// 创建一个provider 用于处理整个服务的运行
const app = new Provider({
  application: {
    name: 'you provider',
    version: '1.0'
  },
  version: '1.1.3',
  ip: '0.0.0.0',
  port: 20880,
  zookeeper: {
    address: 'zookeeper address',
    path: 'path to zookeeper'
  }
})

// 创建一个service 用于公开服务
const service = new Service({
  interface: 'com.remote.Remote',
  version: '1.0'
})

// 向外暴露调用接口
service.method('fun1', async (ctx, next, java) => {
  const {args} = ctx
  const [id] = args
  ctx.result = id
})

// 把service注册给provider
app.addService(service)

// 添加全局中间件
app.use(async (ctx, next, java) => {

})

// 启动整个dubbo服务
app.start(() => {
  console.log('dubbo start done')
})



```


### Provider

服务端构造函数 创建一个dubbo服务端

**参数**

* application.name `string` 服务名称
* application.version `string` 服务版本
* version `string` dubbo版本
* ip `string` 监听ip地址
* port `number` 监听端口
* zookeeper `object` zookeeper 配置 详见 [node-zookeeper-client](https://www.npmjs.com/package/node-zookeeper-client)
* zookeeper.address `string` zookeeper 服务地址
* zookeeper.path `string` zookeeper 上注册的命名空间
* executes `number` 最大执行队列 默认 1k
* timeout `number` 超时时间 默认5秒
* environment `string` 运行环境
* organization `string` 组织架构
* owner `string` 负责人
* revision `string` 修订版本号
* token `string` 是否启用zookeeper token验证


**示例**

```javascript
const {Provider} = require('dubbo4node')

// 创建一个provider 用于处理整个服务的运行
const app = new Provider({
  application: {
    name: 'you provider',
    version: '1.0'
  },
  version: '1.1.3',
  ip: '0.0.0.0',
  port: 20880,
  zookeeper: {
    address: 'zookeeper address',
    path: 'path to zookeeper'
  }
})

```

#### addService
向provider添加一个公开的服务

**参数**

* service `Service` [Service](#Service) 服务

**示例**
```javascript
const {Service} = require('dubbo4node')

const service = new Service({
  interface: 'com.remote.Remote',
  version: '1.0'
})

service.method('fun1', async (ctx, next, java) => {

})

app.addService(service)
```

#### use
向provider添加一个全局的中间件
ps: 需要手动调用 `next()` 来继续执行后面的中间件 否则直接返回 `null`

**示例**
```javascript
app.use(async (ctx, next)=>{
  return 0 // 直接返回一个值的话 则不会再去执行服务里面的方法
})

app.use(async (ctx, next)=>{
  await next()
  console.log(ctx.result) // 获取服务执行结果
})
```

#### start(callback?: Function)
服务启动完成回调

**参数**
* callback `function` 启动完成回调函数

**示例**
```javascript
app.start(() => {
  console.log('dubbo service init done')
})
```

#### <span id="provider-event">event</span>
服务变动事件
* `error` socket 错误
* `close` socket 关闭


### Service
创建一个服务

**参数**

* interface `string` 对外开放的interface名称
* version `string` interface版本

**示例**
```javascript
const {Service} = require('dubbo4node')

const service = new Service({
  interface: 'com.remote',
  version: '1.0'
})
```

#### method(name: string, ...functions: Function[])
向外公开方法

**参数**
* name `string` 方法名称
* ...functions `Function[]` 方法实现

**示例**
```javascript
const {Service} = require('dubbo4node')

const service = new Service({
  interface: 'com.remote.Remote',
  version: '1.0'
})

service.method('fun1', async (ctx, next) => {
  const {args} = ctx
  const [id] = args
  
  await next() // 执行中间件
  ctx.result = id // 返回结果
})
```

### Context
provider调用上下文对象

**属性**

* method `string` 当前方法名
* args `any[]` 调用参数数组
    * 客户端调用方法传递的参数 以数组形式传递进来
* attachments `object` 客户端携带上下文
    * 客户端调用传递的附加数据 包含各种自定义信息 作用类似http cookie的作用
* result `any` 返回结果
    * 当前调用返回给调用方的结果值 可以是任意值
* interface `string` 当前方法所属interface
    * 创建[Service](#Service)时候传递的值
* version `string` 当前interface版本
    * 如上
* buffer `Buffer` 原始数据包
    * 当前dubbo调用的原始数据包
* socket `Socket` 原始socket
    * 当前客户端对应的socket连接
* request `Protocol` 请求协议头
    * 当前客户端对应的请求协议头数据


### middleware
中间件和koa2的书写形式完全一样，只不过多了一个[js-to-java](https://www.npmjs.com/package/js-to-java)库用来协助转换数据

全局中间件优先级高于`Service`的中间件

**示例**

```javascript
const {Provider, Service} = require('dubbo4node')

// 创建一个provider 用于处理整个服务的运行
const app = new Provider({
  application: {
    name: 'you provider',
    version: '1.0'
  },
  version: '1.1.3',
  ip: '0.0.0.0',
  port: 20880,
  zookeeper: {
    address: 'zookeeper address',
    path: 'path to zookeeper'
  }
})

// 创建一个service 用于公开服务
const service = new Service({
  interface: 'com.remote.Remote',
  version: '1.0'
})

// 向外暴露调用接口
service.method('fun1', async (ctx, next, java) => {
  const {args} = ctx
  const [id] = args
  ctx.result = java.String(`${id}`)
})

// 把service注册给provider
app.addService(service)

// 添加全局中间件
app.use(async (ctx, next, java) => {
  // 如果在任意一个中间件内不显示调用 next() 的话则直接返回结果
  ctx.result = java.int(100)
})

// 启动整个dubbo服务
app.start(() => {
  console.log('dubbo start done')
})

```
