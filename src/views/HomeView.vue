<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchPredictionResult } from '../api/ssq'

const loading = ref(false)
const errorText = ref('')
const latestDrawIssue = ref('')
const predictTime = ref('')
const strategies = ref([])

const hasData = computed(() => strategies.value.length > 0)

function formatBall(num) {
  return String(num).padStart(2, '0')
}

function normalizeRedBalls(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') return raw.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

async function loadPredictions() {
  loading.value = true
  errorText.value = ''

  try {
    const response = await fetchPredictionResult()
    const payload = response || {}
    latestDrawIssue.value = payload.latestDrawIssue || payload.latestIssue || payload.issue || ''
    predictTime.value = payload.predictTime || ''
    strategies.value = Array.isArray(payload.strategies) ? payload.strategies : []
  } catch (error) {
    errorText.value = '预测结果加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(loadPredictions)
</script>

<template>
  <main class="page home-page">
    <header class="home-header">
      <div>
        <h1 class="page-title">双色球预测</h1>
        <p class="page-subtitle">多策略结果一览</p>
      </div>
      <RouterLink class="history-link" to="/history">历史开奖</RouterLink>
    </header>

    <section class="meta-row">
      <span class="meta-pill">最新已开奖期号：{{ latestDrawIssue || '--' }}</span>
      <span class="meta-pill">更新时间：{{ predictTime || '--' }}</span>
    </section>

    <section class="content-card">
      <p v-if="loading" class="state-text">正在加载预测结果...</p>
      <p v-else-if="errorText" class="state-text state-error">{{ errorText }}</p>
      <p v-else-if="!hasData" class="state-text">暂无预测结果</p>

      <ul v-else class="strategy-list">
        <li v-for="item in strategies" :key="item.id || item.name" class="strategy-item">
          <div class="strategy-head">
            <p class="strategy-name">{{ item.name || '未命名策略' }}</p>
            <span class="confidence-tag">
              置信度：{{ item.confidence ? `${Math.round(item.confidence * 100)}%` : '--' }}
            </span>
          </div>

          <div class="feature-tags">
            <span v-for="feature in item.featureSet || []" :key="`${item.id || item.name}-${feature}`" class="feature-tag">
              {{ feature }}
            </span>
            <span v-if="!(item.featureSet || []).length" class="feature-tag">默认特征组合</span>
          </div>

          <div class="balls-row">
            <div class="ball-group">
              <span v-for="red in normalizeRedBalls(item.red)" :key="`${item.id || item.name}-red-${red}`" class="ball red">
                {{ formatBall(red) }}
              </span>
            </div>
            <span class="ball blue">{{ formatBall(item.blue || '--') }}</span>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>
