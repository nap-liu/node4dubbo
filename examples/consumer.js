/**
 * Created by liuxi on 2019/02/11.
 */

const {Consumer} = require('../lib')

const dubbo = new Consumer({
  application: 'dubbo4node_consumer',
  version: '1.1.3',
  address: 'your zookeeper address',
  path: 'dubbo4node_provider',
  services: {
    Remote: {
      interface: 'com.remote.Remote',
      version: '1.0',
      methods: {
        fun1: [
          (param, java) => java.int(param)
        ]
      }
    }
  }
})

dubbo.on('error', (e) => {
  console.log('error', e)
})

dubbo.ready().then(async dubbo => {
  const start = Date.now()
  const results = await Promise.all(
    Array.from({length: 1000 * 10}).map(async (_, i) => {
      return dubbo.Remote.fun1(i)
    }))
  console.log(results, (Date.now() - start), (Date.now() - start) / 1000 / 10)
})

