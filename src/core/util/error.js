/* @flow */

import config from '../config'
import { warn } from './debug'
import { inBrowser, inWeex } from './env'
import { isPromise } from 'shared/util'
import { pushTarget, popTarget } from '../observer/dep'

export function handleError (err: Error, vm: any, info: string) {
  // Deactivate deps tracking while processing error handler to avoid possible infinite rendering.
  // See: https://github.com/vuejs/vuex/issues/1505
  pushTarget()
  try {
    if (vm) {
      let cur = vm
      while ((cur = cur.$parent)) { // 循环逐步向父组件反馈错误
        const hooks = cur.$options.errorCaptured // 获取父组件errorCaptured钩子函数
        if (hooks) {
          for (let i = 0; i < hooks.length; i++) {
            try {
               // 当errorCaptured返回false时，直接return，阻止错误继续向父组件传播
              const capture = hooks[i].call(cur, err, vm, info) === false
              if (capture) return
            } catch (e) {
              // errorCaptured钩子函数报错时走这里
              globalHandleError(e, cur, 'errorCaptured hook')
            }
          }
        }
      }
    }
    globalHandleError(err, vm, info)
  } finally {
    popTarget()
  }
}

export function invokeWithErrorHandling (
  handler: Function,
  context: any,
  args: null | any[],
  vm: any,
  info: string
) {
  let res
  try {
    res = args ? handler.apply(context, args) : handler.call(context)
    if (res && !res._isVue && isPromise(res) && !res._handled) {
      res.catch(e => handleError(e, vm, info + ` (Promise/async)`))
      // issue #9511
      // avoid catch triggering multiple times when nested calls
      res._handled = true
    }
  } catch (e) {
    handleError(e, vm, info)
  }
  return res
}

function globalHandleError (err, vm, info) {
  if (config.errorHandler) { // 存在Vue.config.errorHandler时直接执行
    try {
      return config.errorHandler.call(null, err, vm, info)
    } catch (e) {
      // config.errorHandler钩子函数报错时走这里
      if (e !== err) {
        logError(e, null, 'config.errorHandler') // 打印报错
      }
    }
  }
  logError(err, vm, info) // 打印报错
}

// 打印报错
function logError (err, vm, info) {
  if (process.env.NODE_ENV !== 'production') {
    warn(`Error in ${info}: "${err.toString()}"`, vm)
  }
  /* istanbul ignore else */
  if ((inBrowser || inWeex) && typeof console !== 'undefined') {
    console.error(err)
  } else {
    throw err
  }
}
