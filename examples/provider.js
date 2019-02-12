/**
 * Created by liuxi on 2019/02/11.
 */

const {Provider, Service} = require('../lib')

const app = new Provider({
  application: {
    name: 'dubbo4node_provider',
    version: '1.0'
  },
  version: '1.1.3',
  ip: '0.0.0.0',
  port: 20880,
  zookeeper: {
    address: 'your zookeeper address',
    path: 'dubbo4node_provider'
  }
})

const service = new Service({
  interface: 'com.remote.Remote',
  version: '1.0'
})

service.method('fun1', async (ctx, next) => {
  const {args} = ctx
  const [id] = args
  ctx.result = id
})

app.addService(service)

app.start()
