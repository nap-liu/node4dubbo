/**
 * Created by liuxi on 2019/02/01.
 */
import os = require('os')

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
