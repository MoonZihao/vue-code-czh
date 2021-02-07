/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

// 默认属性描述符，与Object.defineProperty配合使用
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

// 在target实例上设置key属性，使获取或修改此key属性时对应的是操作sourceKey，实现代理
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  vm._watchers = [] // 保存当前组件所有watcher实例
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props) // 初始化props
  if (opts.methods) initMethods(vm, opts.methods) // 初始化methods
  if (opts.data) {
    initData(vm) // 初始化data
  } else {
    observe(vm._data = {}, true /* asRootData */) // 不存在data时观察data空对象
  }
  if (opts.computed) initComputed(vm, opts.computed) // 初始化computed
  if (opts.watch && opts.watch !== nativeWatch) { // 存在watch且watch不等于浏览器原生watch时
    initWatch(vm, opts.watch) // 初始化watch
  }
}

/**
 *@Des: 初始化prop
 *@param { propsOptions } 规格化后的props
*/
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {} // 真实props数据
  const props = vm._props = {} // 指向vm._props的指针，保存所有设置到props的变量属性
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = [] // 子组件props key
  const isRoot = !vm.$parent // 是否为根组件
  // 根节点props需要转换为响应式
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm) // 获取props内容
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) { // 不存在时
      proxy(vm, `_props`, key) // 设置一个以key为属性的代理
    }
  }
  toggleObserving(true)
}

// 初始化data
function initData (vm: Component) {
  let data = vm.$options.data // data，为一个function
  data = vm._data = typeof data === 'function'
    ? getData(data, vm) // 为function时，获取data函数返回值
    : data || {}
  if (!isPlainObject(data)) { // data为object时报错
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // 将data代理到vue实例上
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) { // methods和data冲突时报错
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) { // props和data冲突时报错
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      proxy(vm, `_data`, key)
    }
  }
  // 监听 data
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true } // Watcher配置选项

/**
 *@Des: 初始化computed
 *@param { computed } computed
*/
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null) // 保存所有计算属性的watcher实例
  // computed properties are just getters during SSR
  const isSSR = isServerRendering() // 是否服务端渲染
  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    // 非服务端渲染环境，创建watcher实例
    if (!isSSR) {
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) { // key和data冲突时报错
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) { // key和props冲突时报错
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

/**
 *@Des: 在对应vm实例上设置一个计算属性
 *@param { target } vm实例
 *@param { key } key
 *@param { userDef } userDef
*/
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering() // 是否不是服务端渲染，是否应该有缓存
  if (typeof userDef === 'function') { // computed为函数时
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key) // 设置成计算属性的getter函数
      : createGetterInvoker(userDef) // 设置成普通的getter函数
    sharedPropertyDefinition.set = noop
  } else { // computed为对象时
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false // userDef.cache 判断是否使用缓存，vue已弃用
        ? createComputedGetter(key) // 设置成计算属性的getter函数
        : createGetterInvoker(userDef.get) // 设置成普通的getter函数
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () { // 为对象形式 但是没有设置setter
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 设置成计算属性的getter函数
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) { // 计算属性返回值有变化
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

// 设置成普通的getter函数
function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

/**
 *@Des: 初始化methods
 *@param { methods } methods
*/
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') { // method不是function时报错
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) { // method和props冲突时报错
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) { // methods已经存在于vm
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

/**
 *@Des: 初始化watch
 *@param { watch } watch
*/
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

/**
 *@Des: 
 *@param { vm } 当前实例
 *@param { expOrFn } 表达式或计算属性函数
 *@param { handler } watch的值
 *@param { options } 选项
*/
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') { // 如果handler是字符串，则从vm中取出方法
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options) // 实现vm.$watch基本功能
    if (options.immediate) {
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
