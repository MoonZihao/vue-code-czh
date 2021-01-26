import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue) // 初始化
stateMixin(Vue) // 数据相关实例方法挂载
eventsMixin(Vue) // 事件相关实例方法挂载
lifecycleMixin(Vue) // 生命周期相关实例方法挂载
renderMixin(Vue)

export default Vue
