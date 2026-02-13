<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchPredictionResult } from '../api/ssq'

const loading = ref(false)
const errorText = ref('')
const latestDrawIssue = ref('')
const predictTime = ref('')
const totalPeriods = ref(0)
const strategies = ref([])

/** 当前展开描述的策略 id（同时只展开一个） */
const expandedTip = ref(null)

const hasData = computed(() => strategies.value.length > 0)

function formatBall(num) {
  return String(num).padStart(2, '0')
}

function normalizeRedBalls(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') return raw.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

function toggleTip(id) {
  expandedTip.value = expandedTip.value === id ? null : id
}

function formatElapsed(seconds) {
  if (seconds === undefined || seconds === null) return '--'
  if (seconds < 1) return '< 1s'
  return `${seconds}s`
}

async function loadPredictions() {
  loading.value = true
  errorText.value = ''

  try {
    const response = await fetchPredictionResult()
    const payload = response || {}
    latestDrawIssue.value = payload.latestDrawIssue || payload.issue || ''
    predictTime.value = payload.updatedAt || payload.predictTime || ''
    totalPeriods.value = payload.totalPeriods || 0
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
            <div class="strategy-actions">
              <span class="elapsed-tag" v-if="item.elapsed !== undefined">
                {{ formatElapsed(item.elapsed) }}
              </span>
              <button
                v-if="item.description"
                class="tip-btn"
                :class="{ active: expandedTip === (item.id || item.name) }"
                @click="toggleTip(item.id || item.name)"
                title="查看策略说明"
              >
                ?
              </button>
            </div>
          </div>

          <!-- 策略描述气泡 -->
          <Transition name="tip-fade">
            <div v-if="expandedTip === (item.id || item.name) && item.description" class="tip-bubble">
              {{ item.description }}
            </div>
          </Transition>

          <div class="balls-row">
            <div class="ball-group">
              <span
                v-for="red in normalizeRedBalls(item.red)"
                :key="`${item.id || item.name}-red-${red}`"
                class="ball red"
              >
                {{ formatBall(red) }}
              </span>
            </div>
            <span class="ball blue">{{ formatBall(item.blue || '--') }}</span>
          </div>
        </li>
      </ul>
    </section>

    <!-- 免责声明 -->
    <footer class="disclaimer">
      <p>本站预测结果基于历史数据的统计分析与机器学习模型生成，仅供参考，不构成任何购彩建议。</p>
      <p><strong>理性购彩，量力而行。</strong>彩票开奖结果完全随机，任何预测方法均无法保证中奖。</p>
    </footer>
  </main>
</template>

<style scoped>
.strategy-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.elapsed-tag {
  font-size: 11px;
  color: #5e6f95;
  background: #f0f3fa;
  border-radius: 999px;
  padding: 3px 8px;
  white-space: nowrap;
}

.tip-btn {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1.5px solid #b8c7e8;
  border-radius: 50%;
  background: #f4f7ff;
  color: #3b5ea7;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}

.tip-btn:hover,
.tip-btn.active {
  background: #2f5fe7;
  border-color: #2f5fe7;
  color: #fff;
}

.tip-bubble {
  margin-top: 8px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.6;
  color: #354a78;
  background: #eef3ff;
  border: 1px solid #d5e0ff;
  border-radius: 10px;
}

.tip-fade-enter-active,
.tip-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.tip-fade-enter-from,
.tip-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.disclaimer {
  margin-top: 4px;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.7;
  color: #7a8aaa;
  background: rgba(255, 255, 255, 0.6);
  border: 1px dashed #c8d4ef;
  border-radius: 12px;
  text-align: center;
}

.disclaimer p {
  margin: 0;
}

.disclaimer p + p {
  margin-top: 4px;
}

.disclaimer strong {
  color: #c04040;
}
</style>
