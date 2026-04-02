<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { fetchHistoryDraws } from '../api/ssq'

// ══════════════════════════════════════════
//  基本状态
// ══════════════════════════════════════════
const groupCount  = ref(1)
const results     = ref([])
const phase       = ref('idle')   // 'idle' | 'countdown' | 'rolling' | 'done'
const shook       = ref(false)

// ══════════════════════════════════════════
//  Tab 控制：'shake' | 'settings' | 'history'
// ══════════════════════════════════════════
const activeTab = ref('shake')

// ══════════════════════════════════════════
//  D4 倒计时搅机模式
// ══════════════════════════════════════════
const rollMode  = ref(false)
const countdown = ref(0)

// ══════════════════════════════════════════
//  D2 摇一摇
// ══════════════════════════════════════════
const shakeEnabled = ref(false)
const shakeHint    = ref('')    // '' | 'granted' | 'denied' | 'unsupported'
let lastShakeTime  = 0
let shakeCleanup   = null

// ══════════════════════════════════════════
//  A1 排除号码
// ══════════════════════════════════════════
const excludeReds  = ref(new Set())   // 排除的红球
const excludeBlues = ref(new Set())   // 排除的蓝球

// ══════════════════════════════════════════
//  A2 固定号码
// ══════════════════════════════════════════
const pinnedReds = ref(new Set())   // 固定的红球（最多5个，至少留1个随机位）

// ══════════════════════════════════════════
//  A4 连号过滤
// ══════════════════════════════════════════
const noConsecutive = ref(false)

// ══════════════════════════════════════════
//  B1 摇号历史
// ══════════════════════════════════════════
const HISTORY_KEY    = 'ssq_lucky_history'
const MAX_HISTORY    = 50
const shakeHistory   = ref([])

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    shakeHistory.value = raw ? JSON.parse(raw) : []
  } catch { shakeHistory.value = [] }
}

function saveHistory(rows) {
  const entry = {
    id: Date.now(),
    time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    rows: rows.map(r => ({ reds: [...r.reds], blue: r.blue })),
  }
  shakeHistory.value.unshift(entry)
  if (shakeHistory.value.length > MAX_HISTORY) shakeHistory.value = shakeHistory.value.slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(shakeHistory.value))
}

function clearHistory() {
  if (!confirm('确认清空全部历史记录？')) return
  shakeHistory.value = []
  localStorage.removeItem(HISTORY_KEY)
}

// ══════════════════════════════════════════
//  C2 历史开奖对比
// ══════════════════════════════════════════
const recentDraws      = ref([])   // [{ code, reds:[], blue }]
const compareLoading   = ref(false)
const compareLoaded    = ref(false)
const compareCount     = ref(5)    // 对比最近几期

async function loadRecentDraws() {
  compareLoading.value = true
  try {
    const res = await fetchHistoryDraws({ pageNo: 1, pageSize: compareCount.value })
    const list = res?.result || res?.list || (Array.isArray(res) ? res : [])
    recentDraws.value = list.map(item => ({
      code: item.code,
      date: item.date,
      reds: parseRedBalls(item.red),
      blue: String(item.blue).padStart(2, '0'),
    }))
    compareLoaded.value = true
  } catch { recentDraws.value = [] }
  finally { compareLoading.value = false }
}

function parseRedBalls(raw) {
  if (Array.isArray(raw)) return raw.map(n => String(n).padStart(2, '0'))
  if (typeof raw === 'string') return raw.split(',').map(s => String(s.trim()).padStart(2, '0'))
  return []
}

/** 计算某注结果与某期开奖的匹配数 */
function matchCount(row, draw) {
  const redMatch  = row.reds.filter(r => draw.reds.includes(formatBall(r))).length
  const blueMatch = formatBall(row.blue) === draw.blue ? 1 : 0
  return { redMatch, blueMatch }
}

// ══════════════════════════════════════════
//  辅助函数
// ══════════════════════════════════════════
const isValid = computed(() => {
  const n = Number(groupCount.value)
  return Number.isInteger(n) && n >= 1 && n <= 100
})

// 可用红球（排除 + 已固定）
const availableReds = computed(() => {
  return Array.from({ length: 33 }, (_, i) => i + 1)
    .filter(n => !excludeReds.value.has(n) && !pinnedReds.value.has(n))
})

// 可用蓝球
const availableBlues = computed(() => {
  return Array.from({ length: 16 }, (_, i) => i + 1)
    .filter(n => !excludeBlues.value.has(n))
})

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickRandom(arr, count) {
  const pool = [...arr]
  const picked = []
  while (picked.length < count && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length)
    picked.push(pool.splice(i, 1)[0])
  }
  return picked
}

/** A4 连号检测 */
function hasConsecutive(nums) {
  const sorted = [...nums].sort((a, b) => a - b)
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] - sorted[i] === 1) return true
  }
  return false
}

function generateOneLine() {
  const fixedArr = Array.from(pinnedReds.value)
  const needed   = 6 - fixedArr.length
  const pool     = availableReds.value

  if (pool.length < needed) {
    // 可用球不足时忽略限制，直接随机
    const fallback = new Set()
    while (fallback.size < 6) fallback.add(getRandomInt(1, 33))
    return {
      reds: Array.from(fallback).sort((a, b) => a - b),
      blue: availableBlues.value.length > 0
        ? availableBlues.value[Math.floor(Math.random() * availableBlues.value.length)]
        : getRandomInt(1, 16),
    }
  }

  let reds
  let attempts = 0
  do {
    const rand = pickRandom(pool, needed)
    reds = [...fixedArr, ...rand].sort((a, b) => a - b)
    attempts++
    // A4: 若开启连号过滤，最多尝试 30 次
  } while (noConsecutive.value && hasConsecutive(reds) && attempts < 30)

  const bluePool = availableBlues.value
  const blue = bluePool.length > 0
    ? bluePool[Math.floor(Math.random() * bluePool.length)]
    : getRandomInt(1, 16)

  return { reds, blue }
}

function formatBall(num) {
  return String(num).padStart(2, '0')
}

// ══════════════════════════════════════════
//  核心摇号
// ══════════════════════════════════════════
async function commitResults() {
  const count = Number(groupCount.value)
  results.value = Array.from({ length: count }, (_, i) => ({
    index: i + 1,
    reds: Array(6).fill(0),
    blue: 0,
    rolling: true,
    revealed: false,
  }))
  phase.value = 'rolling'
  await nextTick()

  for (let i = 0; i < count; i++) {
    await new Promise(r => setTimeout(r, i === 0 ? 80 : 140))
    const line = generateOneLine()
    results.value[i] = { index: i + 1, ...line, rolling: false, revealed: true }
  }

  phase.value = 'done'
  shook.value = true
  saveHistory(results.value)  // B1
}

async function doShake() {
  if (!isValid.value || phase.value === 'countdown' || phase.value === 'rolling') return
  shook.value = false
  results.value = []

  if (rollMode.value) {
    phase.value = 'countdown'
    for (const n of [3, 2, 1]) {
      countdown.value = n
      await new Promise(r => setTimeout(r, 800))
    }
    countdown.value = 0
    await new Promise(r => setTimeout(r, 160))
  }
  await commitResults()
}

// ══════════════════════════════════════════
//  D3 单注刷新
// ══════════════════════════════════════════
async function reshakeRow(idx) {
  if (phase.value === 'rolling') return
  results.value[idx] = { ...results.value[idx], rolling: true }
  await nextTick()
  await new Promise(r => setTimeout(r, 200))
  const line = generateOneLine()
  results.value[idx] = { index: idx + 1, ...line, rolling: false, revealed: true }
  // 更新历史最后一条
  if (shakeHistory.value.length > 0) {
    shakeHistory.value[0].rows[idx] = { reds: [...line.reds], blue: line.blue }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(shakeHistory.value))
  }
}

// ══════════════════════════════════════════
//  D2 摇一摇
// ══════════════════════════════════════════
function enableShake() {
  if (!window.DeviceMotionEvent) { shakeHint.value = 'unsupported'; return }
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
      .then(res => {
        if (res === 'granted') { bindShake(); shakeEnabled.value = true; shakeHint.value = 'granted' }
        else shakeHint.value = 'denied'
      })
      .catch(() => { shakeHint.value = 'denied' })
  } else {
    bindShake(); shakeEnabled.value = true; shakeHint.value = 'granted'
  }
}

function bindShake() {
  let lastX = null, lastY = null, lastZ = null
  const THRESHOLD = 18
  function onMotion(e) {
    const { x, y, z } = e.accelerationIncludingGravity || {}
    if (lastX === null) { lastX = x; lastY = y; lastZ = z; return }
    const delta = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ)
    lastX = x; lastY = y; lastZ = z
    if (delta > THRESHOLD) {
      const now = Date.now()
      if (now - lastShakeTime > 1500) { lastShakeTime = now; doShake() }
    }
  }
  window.addEventListener('devicemotion', onMotion, { passive: true })
  shakeCleanup = () => window.removeEventListener('devicemotion', onMotion)
}

function disableShake() {
  shakeEnabled.value = false; shakeHint.value = ''
  if (shakeCleanup) { shakeCleanup(); shakeCleanup = null }
}

// ══════════════════════════════════════════
//  A1 / A2 选球 toggle
// ══════════════════════════════════════════
function toggleExcludeRed(n) {
  // 不能同时排除和固定
  if (pinnedReds.value.has(n)) { pinnedReds.value.delete(n) }
  if (excludeReds.value.has(n)) excludeReds.value.delete(n)
  else excludeReds.value.add(n)
}
function togglePinRed(n) {
  if (excludeReds.value.has(n)) { excludeReds.value.delete(n) }
  if (pinnedReds.value.has(n)) pinnedReds.value.delete(n)
  else if (pinnedReds.value.size < 5) pinnedReds.value.add(n)
}
function toggleExcludeBlue(n) {
  if (excludeBlues.value.has(n)) excludeBlues.value.delete(n)
  else excludeBlues.value.add(n)
}
function clearAllFilters() {
  excludeReds.value  = new Set()
  excludeBlues.value = new Set()
  pinnedReds.value   = new Set()
  noConsecutive.value = false
}

// ══════════════════════════════════════════
//  复制
// ══════════════════════════════════════════
const copyToast = ref(false)
function copyAll() {
  if (!results.value.length) return
  const text = results.value
    .filter(r => !r.rolling)
    .map(r => `第${r.index}注: 红球 ${r.reds.map(formatBall).join(' ')}  蓝球 ${formatBall(r.blue)}`)
    .join('\n')
  navigator.clipboard?.writeText(text).catch(() => {})
  copyToast.value = true
  setTimeout(() => { copyToast.value = false }, 1800)
}

// ══════════════════════════════════════════
//  生命周期
// ══════════════════════════════════════════
onMounted(() => {
  loadHistory()
  loadRecentDraws()
})
onUnmounted(() => {
  if (shakeCleanup) shakeCleanup()
})

// ══════════════════════════════════════════
//  长按（移动端固定红球）
// ══════════════════════════════════════════
let touchTimer = null
function handleRedTouchStart(n) {
  touchTimer = setTimeout(() => {
    touchTimer = null
    togglePinRed(n)
  }, 500)
}
function handleRedTouchEnd(n) {
  if (touchTimer !== null) {
    clearTimeout(touchTimer)
    touchTimer = null
    toggleExcludeRed(n)
  }
}

// ══════════════════════════════════════════
//  C2 匹配等级样式
// ══════════════════════════════════════════
function matchClass({ redMatch, blueMatch }) {
  if (blueMatch && redMatch >= 6) return 'match-jackpot'
  if (blueMatch && redMatch >= 5) return 'match-high'
  if (redMatch >= 4 || (blueMatch && redMatch >= 3)) return 'match-mid'
  if (redMatch >= 2 || blueMatch) return 'match-low'
  return 'match-none'
}
</script>

<template>
  <main class="page lucky-page">
    <!-- Header -->
    <header class="lucky-header">
      <div>
        <h1 class="page-title">随机摇号</h1>
        <p class="page-subtitle">双色球随机号码生成器</p>
      </div>
      <div class="dice-icon" :class="{ spinning: phase === 'rolling' || phase === 'countdown' }">🎲</div>
    </header>

    <!-- 规则说明 -->
    <section class="rule-card">
      <p class="rule-text">
        <span class="rule-badge red-badge">红球</span> 01~33 选6个 &nbsp;
        <span class="rule-badge blue-badge">蓝球</span> 01~16 选1个
      </p>
    </section>

    <!-- ████ Tab 导航 ████ -->
    <div class="tab-bar">
      <button class="tab-btn" :class="{ active: activeTab === 'shake' }"   @click="activeTab = 'shake'">🎰 摇号</button>
      <button class="tab-btn" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">⚙️ 号码筛选</button>
      <button class="tab-btn" :class="{ active: activeTab === 'history' }"  @click="activeTab = 'history'">📋 历史记录</button>
    </div>

    <!-- ████ 摇号 Tab ████ -->
    <template v-if="activeTab === 'shake'">
      <section class="input-card">
        <label class="input-label" for="group-count">需要生成的注数</label>
        <div class="input-row">
          <button class="qty-btn" @click="groupCount = Math.max(1, Number(groupCount) - 1)">−</button>
          <input id="group-count" v-model.number="groupCount" class="qty-input"
            type="number" min="1" max="100" inputmode="numeric" pattern="[0-9]*" />
          <button class="qty-btn" @click="groupCount = Math.min(100, Number(groupCount) + 1)">+</button>
        </div>
        <p class="input-hint">可输入 1 ~ 100 注</p>

        <!-- 筛选摘要 -->
        <div v-if="excludeReds.size || pinnedReds.size || excludeBlues.size || noConsecutive" class="filter-summary">
          <span v-if="pinnedReds.size"   class="fs-tag pin-tag">📌 固定 {{ pinnedReds.size }} 个红球</span>
          <span v-if="excludeReds.size"  class="fs-tag ex-tag">🚫 排除 {{ excludeReds.size }} 个红球</span>
          <span v-if="excludeBlues.size" class="fs-tag ex-tag">🚫 排除 {{ excludeBlues.size }} 个蓝球</span>
          <span v-if="noConsecutive"     class="fs-tag con-tag">🔗 过滤连号</span>
          <button class="fs-clear" @click="clearAllFilters">清除全部</button>
        </div>

        <!-- D4 & D2 开关 -->
        <label class="toggle-row" for="roll-mode-toggle">
          <span class="toggle-label">⏱ 倒计时搅机模式</span>
          <span class="toggle-wrap">
            <input id="roll-mode-toggle" type="checkbox" v-model="rollMode" class="toggle-input" />
            <span class="toggle-track" :class="{ on: rollMode }"><span class="toggle-thumb"></span></span>
          </span>
        </label>
        <label class="toggle-row" for="shake-toggle" style="cursor:default">
          <span class="toggle-label">📳 摇一摇触发摇号</span>
          <button id="shake-toggle" class="shake-toggle-btn" :class="{ active: shakeEnabled }"
            @click="shakeEnabled ? disableShake() : enableShake()">
            {{ shakeEnabled ? '已开启' : '开启' }}
          </button>
        </label>
        <Transition name="tip-fade">
          <p v-if="shakeHint === 'granted'"     class="shake-hint success">✅ 摇一摇已开启</p>
          <p v-else-if="shakeHint === 'denied'"      class="shake-hint warn">⚠️ 权限被拒绝，请在系统设置中允许</p>
          <p v-else-if="shakeHint === 'unsupported'" class="shake-hint warn">⚠️ 当前设备不支持此功能</p>
        </Transition>

        <!-- 主按钮 -->
        <button class="shake-btn"
          :class="{ loading: phase === 'rolling' || phase === 'countdown' }"
          :disabled="!isValid || phase === 'rolling' || phase === 'countdown'"
          @click="doShake">
          <Transition name="count-flip" mode="out-in">
            <span v-if="phase === 'countdown'" :key="countdown" class="countdown-num">{{ countdown }}</span>
            <span v-else-if="phase === 'rolling'" class="shake-spinner">🎰</span>
            <span v-else>🎉 开始摇号</span>
          </Transition>
        </button>
        <p v-if="shakeEnabled" class="shake-tip-mini">或摇动手机触发</p>
      </section>

      <!-- 结果区域 -->
      <section v-if="shook || phase !== 'idle'" class="result-card">
        <div class="result-header">
          <p class="result-title">摇号结果</p>
          <Transition name="tip-fade">
            <span v-if="copyToast" class="copy-toast">✅ 已复制</span>
            <button v-else-if="results.some(r => !r.rolling)" class="copy-btn" @click="copyAll">复制全部</button>
          </Transition>
        </div>

        <ul class="result-list">
          <li v-for="(row, idx) in results" :key="row.index"
              class="result-row" :class="{ rolling: row.rolling, revealed: row.revealed }">
            <span class="row-index">第 {{ row.index }} 注</span>

            <!-- D1 球飞入 -->
            <div class="balls-row">
              <div class="ball-group">
                <span v-for="(r, bi) in row.reds" :key="bi" class="ball red"
                  :class="{ 'ball-rolling': row.rolling, 'ball-fly-in': row.revealed,
                             'ball-pinned': pinnedReds.has(r) && row.revealed }"
                  :style="row.revealed ? { animationDelay: `${bi * 55}ms` } : { animationDelay: `${bi * 80}ms` }">
                  {{ row.rolling ? '?' : formatBall(r) }}
                </span>
              </div>
              <span class="ball blue"
                :class="{ 'ball-rolling': row.rolling, 'ball-fly-in': row.revealed }"
                :style="row.revealed ? { animationDelay: '340ms' } : {}">
                {{ row.rolling ? '?' : formatBall(row.blue) }}
              </span>
            </div>

            <!-- D3 单注刷新 -->
            <button v-if="row.revealed" class="reshake-btn" title="重新摇这注" @click="reshakeRow(idx)">🔄</button>
          </li>
        </ul>

        <!-- C2 历史开奖对比 -->
        <div v-if="shook && results.length > 0 && compareLoaded" class="compare-section">
          <p class="compare-title">📊 与近期开奖对比</p>
          <div class="compare-scroll">
            <table class="compare-table">
              <thead>
                <tr>
                  <th>期号</th>
                  <th v-for="(row, idx) in results.filter(r => r.revealed)" :key="idx">第{{ row.index }}注</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="draw in recentDraws" :key="draw.code">
                  <td class="draw-code-cell">{{ draw.code }}<br><small>{{ draw.date }}</small></td>
                  <td v-for="(row, idx) in results.filter(r => r.revealed)" :key="idx" class="match-cell">
                    <span
                      class="match-badge"
                      :class="matchClass(matchCount(row, draw))">
                      <span class="match-red">红{{ matchCount(row, draw).redMatch }}</span>+<span class="match-blue">蓝{{ matchCount(row, draw).blueMatch }}</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="compare-hint">对比最近 {{ recentDraws.length }} 期开奖号码 · 仅供参考</p>
        </div>
        <div v-else-if="shook && compareLoading" class="compare-loading">
          <p class="state-text">正在加载历史开奖...</p>
        </div>
      </section>
    </template>

    <!-- ████ 号码筛选 Tab ████ -->
    <template v-if="activeTab === 'settings'">
      <section class="settings-card">
        <div class="settings-section-title">
          <span>🔴 红球设置</span>
          <span class="settings-legend">
            <span class="legend-dot pinned-dot"></span>固定
            <span class="legend-dot excluded-dot"></span>排除
          </span>
        </div>
        <p class="settings-hint">单击：排除  |  长按：固定（最多5个）</p>

        <div class="ball-picker">
          <button
            v-for="n in 33" :key="n"
            class="pick-ball"
            :class="{
              'pick-pinned':   pinnedReds.has(n),
              'pick-excluded': excludeReds.has(n),
              'pick-normal':   !pinnedReds.has(n) && !excludeReds.has(n),
            }"
            @click="toggleExcludeRed(n)"
            @contextmenu.prevent="togglePinRed(n)"
            @touchstart.prevent="handleRedTouchStart(n)"
            @touchend.prevent="handleRedTouchEnd(n)"
          >{{ formatBall(n) }}</button>
        </div>

        <div class="settings-section-title" style="margin-top:14px">
          <span>🔵 蓝球排除</span>
        </div>
        <p class="settings-hint">单击选中即排除</p>
        <div class="ball-picker">
          <button
            v-for="n in 16" :key="n"
            class="pick-ball pick-blue-ball"
            :class="{ 'pick-excluded-blue': excludeBlues.has(n), 'pick-normal-blue': !excludeBlues.has(n) }"
            @click="toggleExcludeBlue(n)"
          >{{ formatBall(n) }}</button>
        </div>

        <!-- A4 连号过滤 -->
        <div class="settings-section-title" style="margin-top:14px">
          <span>🔗 连号过滤</span>
        </div>
        <label class="toggle-row" for="no-consecutive">
          <span class="toggle-label">不生成含连续号码的结果</span>
          <span class="toggle-wrap">
            <input id="no-consecutive" type="checkbox" v-model="noConsecutive" class="toggle-input" />
            <span class="toggle-track" :class="{ on: noConsecutive }"><span class="toggle-thumb"></span></span>
          </span>
        </label>
        <p class="settings-hint" style="text-align:center">连号指相差1的号码，如 05、06</p>

        <button class="clear-all-btn" @click="clearAllFilters">🗑 清除全部筛选</button>
      </section>
    </template>

    <!-- ████ 历史记录 Tab ████ -->
    <template v-if="activeTab === 'history'">
      <section class="history-tab-card">
        <div class="result-header">
          <p class="result-title">📋 摇号历史</p>
          <button v-if="shakeHistory.length" class="copy-btn danger-btn" @click="clearHistory">清空</button>
        </div>

        <p v-if="!shakeHistory.length" class="state-text">暂无记录，摇号后自动保存</p>

        <div v-for="entry in shakeHistory" :key="entry.id" class="history-entry">
          <div class="history-entry-head">
            <span class="history-time">{{ entry.time }}</span>
            <span class="history-count">{{ entry.rows.length }} 注</span>
          </div>
          <div v-for="(row, ri) in entry.rows" :key="ri" class="history-row">
            <span class="row-index">第 {{ ri + 1 }} 注</span>
            <div class="balls-row">
              <div class="ball-group">
                <span v-for="r in row.reds" :key="r" class="ball red sm-ball">{{ formatBall(r) }}</span>
              </div>
              <span class="ball blue sm-ball">{{ formatBall(row.blue) }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- 免责 -->
    <footer class="disclaimer">
      <p>摇号结果完全随机，仅供娱乐参考。<strong>理性购彩，量力而行。</strong></p>
    </footer>
  </main>
</template>



<style scoped>
/* ══ 页面基础 ══ */
.lucky-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 88px;
}

/* ══ Header ══ */
.lucky-header {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: linear-gradient(135deg, #f06000 0%, #f5a623 100%);
  border-radius: 16px; padding: 14px 12px; color: #fff;
  box-shadow: 0 8px 20px rgba(240,96,0,.28);
}
.dice-icon { font-size: 40px; transition: transform .3s; will-change: transform; }
.dice-icon.spinning { animation: dice-spin .4s linear infinite; }
@keyframes dice-spin {
  from { transform: rotate(0deg) scale(1); }
  50%  { transform: rotate(180deg) scale(1.25); }
  to   { transform: rotate(360deg) scale(1); }
}

/* ══ Rule card ══ */
.rule-card { background: rgba(255,255,255,.9); border: 1px solid #ffe0c0; border-radius: 14px; padding: 10px 14px; }
.rule-text { margin:0; font-size:13px; color:#4a3020; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.rule-badge { display:inline-block; padding:2px 9px; border-radius:999px; font-size:12px; font-weight:700; color:#fff; }
.red-badge  { background: linear-gradient(180deg,#ff7272 0%,#e03636 100%); }
.blue-badge { background: linear-gradient(180deg,#6aa5ff 0%,#2a67d8 100%); }

/* ══ Tab Bar ══ */
.tab-bar {
  display: flex; gap: 6px;
  background: rgba(255,255,255,.82);
  border: 1px solid #ffe0c0;
  border-radius: 14px;
  padding: 5px;
}
.tab-btn {
  flex: 1; padding: 8px 4px; border: none; border-radius: 10px;
  background: transparent; font-size: 12px; font-weight: 600; color: #a08060;
  cursor: pointer; transition: all .18s; white-space: nowrap;
}
.tab-btn.active { background: linear-gradient(135deg,#f06000,#f5a623); color: #fff; box-shadow: 0 3px 10px rgba(240,96,0,.28); }

/* ══ Input card ══ */
.input-card {
  background: rgba(255,255,255,.88); border: 1px solid #ffe0c0; border-radius: 16px;
  padding: 18px 16px; display: flex; flex-direction: column; align-items: center; gap: 10px;
  box-shadow: 0 6px 20px rgba(240,96,0,.08);
}
.input-label { font-size:15px; font-weight:700; color:#3a2010; }
.input-row   { display:flex; align-items:center; gap:12px; }
.qty-btn {
  display:grid; place-items:center; width:44px; height:44px; border-radius:50%;
  border:2px solid #f06000; background:#fff; color:#f06000; font-size:22px; font-weight:700;
  cursor:pointer; transition:all .15s; padding:0;
}
.qty-btn:active { background:#f06000; color:#fff; transform:scale(.93); }
.qty-input {
  width:90px; height:52px; text-align:center; font-size:28px; font-weight:700; color:#2a1800;
  border:2px solid #f5c080; border-radius:12px; background:#fffaf5; outline:none; -moz-appearance:textfield;
}
.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button { -webkit-appearance:none; }
.qty-input:focus { border-color:#f06000; box-shadow:0 0 0 3px rgba(240,96,0,.14); }
.input-hint { margin:0; font-size:12px; color:#b07040; }

/* ══ 筛选摘要 ══ */
.filter-summary {
  width:100%; max-width:280px;
  display:flex; flex-wrap:wrap; gap:5px; align-items:center; justify-content:center;
  padding: 8px 10px;
  background: #fff9f0; border: 1px solid #ffd090; border-radius: 10px;
  font-size: 12px;
}
.fs-tag { padding:3px 8px; border-radius:999px; font-weight:600; }
.pin-tag { background:#fff0d0; color:#a06000; }
.ex-tag  { background:#fff0f0; color:#c04040; }
.con-tag { background:#f0f0ff; color:#4040c0; }
.fs-clear { font-size:11px; padding:3px 10px; border-radius:999px; border:1px solid #f5a623; background:#fff; color:#a06020; cursor:pointer; }

/* ══ Toggle row ══ */
.toggle-row {
  width:100%; max-width:280px; display:flex; align-items:center;
  justify-content:space-between; cursor:pointer; user-select:none;
}
.toggle-label { font-size:13px; color:#5a3820; font-weight:500; }
.toggle-wrap  { position:relative; }
.toggle-input { position:absolute; opacity:0; width:0; height:0; }
.toggle-track {
  display:block; width:44px; height:24px; border-radius:999px; background:#d0c8c0;
  transition:background .25s; position:relative;
}
.toggle-track.on { background:#f06000; }
.toggle-thumb {
  position:absolute; top:3px; left:3px; width:18px; height:18px;
  border-radius:50%; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.2); transition:transform .25s;
}
.toggle-track.on .toggle-thumb { transform:translateX(20px); }

/* ══ D2 摇一摇按钮 ══ */
.shake-toggle-btn {
  font-size:12px; padding:5px 14px; border-radius:999px;
  border:1.5px solid #f06000; background:#fff; color:#f06000; font-weight:600; cursor:pointer; transition:all .18s;
}
.shake-toggle-btn.active { background:#f06000; color:#fff; }
.shake-hint { margin:-4px 0 0; font-size:11px; text-align:center; }
.shake-hint.success { color:#1a8040; }
.shake-hint.warn    { color:#a05020; }
.shake-tip-mini     { margin:-6px 0 0; font-size:11px; color:#b07040; }

/* ══ 主摇号按钮 ══ */
.shake-btn {
  margin-top:4px; width:100%; max-width:280px; padding:14px 0;
  border:none; border-radius:999px;
  background:linear-gradient(135deg,#f06000 0%,#f5a623 100%);
  color:#fff; font-size:18px; font-weight:700; cursor:pointer;
  box-shadow:0 6px 20px rgba(240,96,0,.35); transition:transform .15s, box-shadow .15s;
  letter-spacing:1px; min-height:52px; display:flex; align-items:center; justify-content:center; overflow:hidden;
}
.shake-btn:active:not(:disabled) { transform:scale(.96); box-shadow:0 2px 10px rgba(240,96,0,.25); }
.shake-btn:disabled { opacity:.6; cursor:not-allowed; }
.shake-btn.loading  { background:linear-gradient(135deg,#c0a060,#e0c090); }
.countdown-num  { font-size:28px; font-weight:900; display:block; line-height:1; }
.shake-spinner  { font-size:22px; animation:spin .6s linear infinite; display:inline-block; }
@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
.count-flip-enter-active { transition:all .2s cubic-bezier(.34,1.56,.64,1); }
.count-flip-leave-active  { transition:all .15s ease; }
.count-flip-enter-from    { opacity:0; transform:scale(2.2); }
.count-flip-leave-to      { opacity:0; transform:scale(.5); }

/* ══ Result card ══ */
.result-card {
  background:rgba(255,255,255,.88); border:1px solid #ffe0c0; border-radius:16px;
  padding:14px 12px; box-shadow:0 6px 20px rgba(240,96,0,.08);
}
.result-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; min-height:28px; }
.result-title  { margin:0; font-size:15px; font-weight:700; color:#3a2010; }
.copy-btn { font-size:12px; padding:5px 12px; border-radius:999px; border:1px solid #f5a623; background:#fff8f0; color:#a06020; cursor:pointer; transition:all .15s; }
.copy-btn:active { background:#f5a623; color:#fff; }
.copy-toast { font-size:12px; color:#1a8040; font-weight:600; }
.danger-btn { border-color:#e05050; color:#c03030; background:#fff5f5; }
.danger-btn:active { background:#e05050; color:#fff; }

.result-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
.result-row {
  display:flex; align-items:center; gap:8px; padding:10px 8px; border-radius:12px;
  background:linear-gradient(180deg,#ffffff 0%,#fff8f0 100%); border:1px solid #ffe0c0;
  flex-wrap:wrap; position:relative;
}
.result-row.rolling { border-color:#f5a623; background:linear-gradient(180deg,#fffbe8,#fff5d5); }
.row-index { font-size:12px; font-weight:700; color:#b07040; white-space:nowrap; min-width:46px; }

/* ══ D1 球动效 ══ */
.ball-rolling { animation:ball-roll .45s ease infinite alternate; filter:blur(.5px); opacity:.85; }
@keyframes ball-roll { from{transform:translateY(0) scale(1)} to{transform:translateY(-7px) scale(1.08)} }
.ball-fly-in  { animation:ball-fly .38s cubic-bezier(.22,1,.36,1) both; }
@keyframes ball-fly { from{opacity:0;transform:translateY(20px) scale(.5)} to{opacity:1;transform:translateY(0) scale(1)} }
/* A2 固定球高亮 */
.ball-pinned  { box-shadow:0 0 0 2.5px #fff, 0 0 0 4px #f5a623 !important; }

/* ══ D3 单注刷新 ══ */
.reshake-btn {
  margin-left:auto; flex-shrink:0; width:30px; height:30px; border-radius:50%;
  border:1.5px solid #f0d0a0; background:#fff8f0; font-size:14px; cursor:pointer;
  display:grid; place-items:center; transition:all .18s; padding:0;
}
.reshake-btn:active { transform:rotate(180deg) scale(.9); background:#f5a623; border-color:#f5a623; }

/* ══ C2 对比 ══ */
.compare-section { margin-top:14px; border-top:1px dashed #f0c090; padding-top:12px; }
.compare-title   { margin:0 0 8px; font-size:13px; font-weight:700; color:#6a4020; }
.compare-scroll  { overflow-x:auto; }
.compare-table   { width:100%; border-collapse:collapse; font-size:11px; }
.compare-table th,
.compare-table td { padding:5px 6px; text-align:center; border-bottom:1px solid #f5e8d0; white-space:nowrap; }
.compare-table th { color:#8a6040; font-weight:600; background:#fff8f0; }
.draw-code-cell  { font-size:11px; color:#8a6040; }
.draw-code-cell small { display:block; color:#b09070; font-size:10px; }
.match-badge { display:inline-flex; align-items:center; gap:2px; padding:2px 6px; border-radius:999px; font-weight:700; font-size:10px; }
.match-red  { color:#e03636; }
.match-blue { color:#2a67d8; }
.match-jackpot { background:#fff0a0; }
.match-high    { background:#ffe0c0; }
.match-mid     { background:#f0f0f0; }
.match-low     { background:#f8f8f8; color:#808080; }
.match-none    { color:#ccc; }
.compare-hint  { margin:6px 0 0; font-size:10px; color:#b09070; text-align:center; }
.compare-loading { padding:12px 0; }

/* ══ 号码筛选 Tab ══ */
.settings-card {
  background:rgba(255,255,255,.88); border:1px solid #ffe0c0; border-radius:16px;
  padding:16px; box-shadow:0 6px 20px rgba(240,96,0,.08);
  display:flex; flex-direction:column; gap:10px;
}
.settings-section-title {
  display:flex; align-items:center; justify-content:space-between;
  font-size:14px; font-weight:700; color:#5a3020;
}
.settings-hint { margin:0; font-size:11px; color:#a08060; text-align:center; }
.settings-legend { display:flex; align-items:center; gap:6px; font-size:11px; color:#8a6040; font-weight:400; }
.legend-dot { display:inline-block; width:10px; height:10px; border-radius:50%; }
.pinned-dot   { background:linear-gradient(180deg,#ffd070,#f5a623); border:1.5px solid #f06000; }
.excluded-dot { background:#e0e0e0; border:1.5px solid #aaa; }

.ball-picker { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; }
.pick-ball {
  width:34px; height:34px; border-radius:50%; border:2px solid #ddd;
  font-size:11px; font-weight:700; cursor:pointer; transition:all .18s;
  display:grid; place-items:center; padding:0; position:relative;
  -webkit-user-select:none; user-select:none;
}
.pick-normal   { background:linear-gradient(180deg,#ff9090,#e03636); color:#fff; border-color:#e03636; }
.pick-pinned   { background:linear-gradient(180deg,#ffd070,#f5a623); color:#fff; border-color:#f06000;
                 box-shadow:0 0 0 2px #fff, 0 0 0 4px #f06000; }
.pick-excluded { background:#e8e8e8; color:#aaa; border-color:#ccc; }
.pick-blue-ball  { }
.pick-normal-blue  { background:linear-gradient(180deg,#6aa5ff,#2a67d8); color:#fff; border-color:#2a67d8; }
.pick-excluded-blue{ background:#e8e8e8; color:#aaa; border-color:#ccc; }

.clear-all-btn {
  width:100%; padding:10px; border:none; border-radius:999px;
  background:linear-gradient(135deg,#808080,#aaa); color:#fff; font-size:14px;
  font-weight:700; cursor:pointer; transition:all .15s; box-shadow:0 3px 10px rgba(0,0,0,.12);
}
.clear-all-btn:active { transform:scale(.97); }

/* ══ 历史 Tab ══ */
.history-tab-card {
  background:rgba(255,255,255,.88); border:1px solid #ffe0c0; border-radius:16px;
  padding:16px 12px; box-shadow:0 6px 20px rgba(240,96,0,.08);
  display:flex; flex-direction:column; gap:10px;
}
.history-entry {
  border:1px solid #ffe0c0; border-radius:12px; overflow:hidden;
  background:linear-gradient(180deg,#fff,#fff9f0);
}
.history-entry-head {
  display:flex; justify-content:space-between; align-items:center;
  padding:6px 10px; background:#fff5e0; font-size:12px;
}
.history-time  { color:#8a6030; font-weight:600; }
.history-count { color:#b07040; }
.history-row   { display:flex; align-items:center; gap:8px; padding:6px 10px; border-top:1px solid #ffe8d0; flex-wrap:wrap; }
.sm-ball { width:26px !important; height:26px !important; font-size:11px !important; }

/* ══ Balls通用 ══ */
.balls-row  { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ball-group { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
.ball {
  display:inline-grid; place-items:center; width:32px; height:32px; border-radius:50%;
  font-size:13px; font-weight:700; color:#fff;
  box-shadow:inset 0 -3px 0 rgba(0,0,0,.12);
}
.ball.red  { background:linear-gradient(180deg,#ff7272,#e03636); }
.ball.blue { background:linear-gradient(180deg,#6aa5ff,#2a67d8); }

/* ══ Transition ══ */
.tip-fade-enter-active { transition:opacity .2s, transform .2s; }
.tip-fade-leave-active { transition:opacity .15s; }
.tip-fade-enter-from   { opacity:0; transform:translateY(-4px); }
.tip-fade-leave-to     { opacity:0; }

/* ══ Disclaimer ══ */
.disclaimer {
  margin-top:auto; padding:12px 16px; font-size:13px; line-height:1.7; color:#9a8070;
  background:rgba(255,255,255,.6); border:1px dashed #f0c090; border-radius:12px; text-align:center;
}
.disclaimer p { margin:0; }
.disclaimer strong { color:#c04040; }

.state-text { margin:12px 0; text-align:center; font-size:14px; color:#a08060; }
</style>
