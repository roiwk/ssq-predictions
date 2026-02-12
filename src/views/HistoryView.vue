<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchHistoryDraws } from '../api/ssq'

const loading = ref(false)
const loadingMore = ref(false)
const errorText = ref('')
const historyList = ref([])
const pageNo = ref(1)
const pageSize = ref(20)
const total = ref(0)

const hasData = computed(() => historyList.value.length > 0)
const hasMore = computed(() => historyList.value.length < total.value)

const sentinelRef = ref(null)
const showBackTop = ref(false)
let observer = null

function formatBall(num) {
  return String(num).padStart(2, '0')
}

function parseRedBalls(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') return raw.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

function formatMoney(raw) {
  if (!raw) return '--'
  const num = Number(raw)
  if (Number.isNaN(num)) return raw
  return num.toLocaleString('zh-CN')
}

function normalizePrize(prizegrades = []) {
  return prizegrades
    .filter((item) => item?.typenum || item?.typemoney)
    .map((item) => ({
      label: `${item.type || '-'}等奖`,
      count: item.typenum || '--',
      money: item.typemoney || '--',
    }))
}

function mapItems(result) {
  return (result || []).map((item) => ({
    ...item,
    prizeRows: normalizePrize(item.prizegrades),
  }))
}

async function loadHistory() {
  loading.value = true
  errorText.value = ''

  try {
    const response = await fetchHistoryDraws({
      pageNo: 1,
      pageSize: pageSize.value,
    })

    total.value = Number(response?.total || 0)
    pageNo.value = 1
    historyList.value = mapItems(response?.result)
  } catch (error) {
    errorText.value = '历史开奖加载失败，请稍后重试'
  } finally {
    loading.value = false
    await nextTick()
    setupObserver()
  }
}

async function loadMore() {
  if (loadingMore.value || loading.value || !hasMore.value) return

  loadingMore.value = true
  const nextPage = pageNo.value + 1

  try {
    const response = await fetchHistoryDraws({
      pageNo: nextPage,
      pageSize: pageSize.value,
    })

    total.value = Number(response?.total || total.value)
    const newItems = mapItems(response?.result)
    historyList.value = [...historyList.value, ...newItems]
    pageNo.value = nextPage
  } catch (_) {
    // 加载更多失败静默处理，用户可再次触底重试
  } finally {
    loadingMore.value = false
  }
}

function setupObserver() {
  if (observer) {
    observer.disconnect()
  }
  if (!sentinelRef.value) return

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        loadMore()
      }
    },
    { rootMargin: '200px' },
  )
  observer.observe(sentinelRef.value)
}

function onScroll() {
  showBackTop.value = window.scrollY > 400
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  loadHistory()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => {
  if (observer) observer.disconnect()
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <main class="page history-page">
    <header class="history-header">
      <RouterLink class="back-link" to="/">返回首页</RouterLink>
      <div class="history-title-block">
        <h1 class="page-title">历史开奖</h1>
        <span class="total-text">共 {{ total || 0 }} 条</span>
      </div>
    </header>

    <section class="history-content">
      <p v-if="loading" class="state-text">正在加载历史开奖...</p>
      <p v-else-if="errorText" class="state-text state-error">{{ errorText }}</p>
      <p v-else-if="!hasData" class="state-text">暂无历史开奖数据</p>

      <template v-else>
        <ul class="history-list">
          <li v-for="item in historyList" :key="item.code" class="history-item">
            <div class="draw-head">
              <p class="draw-code">第 {{ item.code }} 期</p>
              <p class="draw-date">{{ item.date }}</p>
            </div>

            <div class="balls-row">
              <div class="ball-group">
                <span v-for="red in parseRedBalls(item.red)" :key="`${item.code}-red-${red}`" class="ball red">
                  {{ formatBall(red) }}
                </span>
              </div>
              <span class="ball blue">{{ formatBall(item.blue || '--') }}</span>
            </div>

            <p class="draw-content">{{ item.content || '暂无中奖说明' }}</p>

            <details class="detail-box">
              <summary>查看奖级详情</summary>
              <div class="detail-grid">
                <p>销售额：{{ formatMoney(item.sales) }}</p>
                <p>奖池：{{ formatMoney(item.poolmoney) }}</p>
                <p>一等奖注数：{{ item.prizeRows?.[0]?.count || '--' }}</p>
                <p>二等奖注数：{{ item.prizeRows?.[1]?.count || '--' }}</p>
              </div>

              <ul class="prize-list">
                <li v-for="prize in item.prizeRows" :key="`${item.code}-${prize.label}`">
                  {{ prize.label }}：{{ prize.count }} 注 / {{ prize.money }}
                </li>
              </ul>
            </details>
          </li>
        </ul>

        <!-- 触底哨兵 + 加载状态 -->
        <div ref="sentinelRef" class="scroll-sentinel">
          <p v-if="loadingMore" class="state-text">正在加载更多...</p>
          <p v-else-if="!hasMore" class="state-text state-end">已加载全部数据</p>
        </div>
      </template>
    </section>

    <Transition name="fade">
      <button v-show="showBackTop" class="back-top-btn" aria-label="回到顶部" @click="scrollToTop">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    </Transition>
  </main>
</template>
