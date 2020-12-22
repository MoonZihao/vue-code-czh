/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto) // 继承Array.prototype，具备Array.prototype所有功能

// 需要封装的数组方法
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
// 拦截器
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]

  // 使用Object.defineProperty封装push等方法
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args) // 执行原生Array.prototype上的方法
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})
