/**
 * Created by liuxi on 2019/02/01.
 */
import os = require('os')
import { Context } from '../provider/context'
import java = require('js-to-java')

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
  return Object.keys(interfaces)
    .map(function (nic) {
      const addresses = interfaces[nic].filter(function (details) {
        return details.family.toLowerCase() === 'ipv4' && !isLoopback(details.address)
      })
      return addresses.length ? addresses[0].address : undefined
    })
    .filter(Boolean)[0]
}

export function compose (...functions: Function[]) {
  function dispatch (index: number, ctx?: Context) {
    return async (context: Context) => {
      let fn: Function
      if (index === functions.length - 1) {
        fn = functions[index].bind(this, ctx || context, async () => {})
      } else {
        fn = functions[index].bind(this, ctx || context, dispatch(index + 1, ctx || context))
      }
      return fn(java)
    }
  }

  return dispatch(0)
}
