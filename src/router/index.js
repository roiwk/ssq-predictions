import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import HistoryView from '../views/HistoryView.vue'
import LuckyView from '../views/LuckyView.vue'

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
    {
      path: '/lucky',
      name: 'lucky',
      component: LuckyView,
      meta: {
        title: '随机摇号 - 双色球预测',
        description: '按双色球规则随机生成号码，支持自定义注数，前端本地摇号。',
      },
    },
  ],
})

const SITE_URL = 'https://ssq.roiwk.cn'

router.afterEach((to) => {
  const title = to.meta.title || DEFAULT_TITLE
  const description = to.meta.description || ''
  const url = `${SITE_URL}${to.path}`

  // 更新 title
  document.title = title

  // 更新 meta description
  updateMeta('name', 'description', description)

  // 更新 canonical
  updateLink('canonical', url)

  // 更新 Open Graph
  updateMeta('property', 'og:title', title)
  updateMeta('property', 'og:description', description)
  updateMeta('property', 'og:url', url)

  // 更新 Twitter Card
  updateMeta('name', 'twitter:title', title)
  updateMeta('name', 'twitter:description', description)
})

function updateMeta(attr, key, value) {
  let el = document.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function updateLink(rel, href) {
  let el = document.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export default router
