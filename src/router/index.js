import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import HistoryView from '../views/HistoryView.vue'

const DEFAULT_TITLE = '双色球预测 - 多策略智能分析与历史开奖查询'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: {
        title: '双色球预测 - 多策略智能分析',
        description: '双色球多策略智能预测分析平台，提供多种预测策略结果一览。',
      },
    },
    {
      path: '/history',
      name: 'history',
      component: HistoryView,
      meta: {
        title: '历史开奖查询 - 双色球预测',
        description: '查询双色球历史开奖号码、奖级详情、销售额与奖池数据。',
      },
    },
  ],
})

router.afterEach((to) => {
  document.title = to.meta.title || DEFAULT_TITLE

  // 动态更新 meta description
  const descEl = document.querySelector('meta[name="description"]')
  if (descEl && to.meta.description) {
    descEl.setAttribute('content', to.meta.description)
  }
})

export default router
