<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchHistoryDraws } from '../api/ssq'

const loading = ref(false)
const errorText = ref('')
const historyList = ref([])
const pageNo = ref(1)
const pageSize = ref(20)
const total = ref(0)

const hasData = computed(() => historyList.value.length > 0)

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

async function loadHistory() {
  loading.value = true
  errorText.value = ''

  try {
    const response = await fetchHistoryDraws({
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    })

    total.value = Number(response?.total || 0)
    historyList.value = (response?.result || []).map((item) => ({
      ...item,
      prizeRows: normalizePrize(item.prizegrades),
    }))
  } catch (error) {
    errorText.value = '历史开奖加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(loadHistory)
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

      <ul v-else class="history-list">
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
    </section>
  </main>
</template>
