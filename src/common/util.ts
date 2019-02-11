/**
 * Created by liuxi on 2019/02/01.
 */
import os = require('os')
import { Context } from '../provider/context'
import java = require('js-to-java')
import { ServiceError } from '..'

export function isLoopback (addr: string) {
  return (
    /^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/.test(addr) ||
    /^fe80::1$/.test(addr) ||
    /^::1$/.test(addr) ||
    /^::$/.test(addr)
  )
}

export function ip (): string {
  const interfaces = os.networkInterfaces()
  return Object.keys(interfaces).map(function (nic) {
    const addresses = interfaces[nic].filter(function (details) {
      return details.family.toLowerCase() === 'ipv4' && !isLoopback(details.address)
    })
    return addresses.length ? addresses[0].address : undefined
  }).filter(Boolean)[0]
}

/**
 * 中间件合并函数
 * @param {Function} functions
 * @returns {(context: Context, next?: Function) => Promise<void> | Promise<any> | Promise<never>}
 */
export function compose (...functions: Function[]) {
  if (!Array.isArray(functions)) throw new Error('中间件调用栈必须是数组')
  for (let i in functions) if (typeof functions[i] !== 'function') new Error('中间件必须是函数')
  return (context: Context, next?: Function) => {
    let index = -1

    function dispatch (i: number) {
      if (i <= index) {
        throw new ServiceError('中间件不能重复调用')
      }
      index = i
      let fn = functions[i]
      if (i === functions.length) {
        fn = next
      }

      if (!fn) {
        return Promise.resolve()
      }

      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1), java))
      } catch (e) {
        return Promise.reject(e)
      }
    }

    return dispatch(0)
  }
}
