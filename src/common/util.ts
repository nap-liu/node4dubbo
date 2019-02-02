/**
 * Created by liuxi on 2019/02/01.
 */
import os = require('os')
import { Context } from '../provider/context'

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

export function compose (...funcs: Function[]) {
  return async function (ctx: Context, args: any[]) {
    let result = null
    let defaultNext = () => {}
    for (let i = 0, l = funcs.length; i < l; i++) {
      const next = i === l ? defaultNext : funcs[i + 1].bind(ctx, args, ctx)
      result = await funcs[i](args, ctx, next)
    }
    return result
  }
}
