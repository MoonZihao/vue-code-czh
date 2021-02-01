import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  // 必须使用new来调用Vue，保证不会被当作普通函数调用
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options) // 执行生命周期初始化流程
}

initMixin(Vue) // 初始化
stateMixin(Vue) // 数据相关实例方法挂载
eventsMixin(Vue) // 事件相关实例方法挂载
lifecycleMixin(Vue) // 生命周期相关实例方法挂载
renderMixin(Vue)

export default Vue
