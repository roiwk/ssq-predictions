<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { fetchHistoryDraws } from '../api/ssq'

// ══════════════════════════════════════════
//  基本状态
// ══════════════════════════════════════════
const groupCount      = ref(1)
const results         = ref([])
const phase           = ref('idle')   // 'idle' | 'countdown' | 'rolling' | 'done'
const shook           = ref(false)
const inputCollapsed  = ref(false)    // 摇完后折叠输入区

// ══════════════════════════════════════════
//  Tab 控制：'shake' | 'compound' | 'settings' | 'history'
// ══════════════════════════════════════════
const activeTab = ref('shake')

// ══════════════════════════════════════════
//  复式摇号
// ══════════════════════════════════════════
const compoundRedCount  = ref(7)   // 选几个红球 6~20
const compoundBlueCount = ref(1)   // 选几个蓝球 1~16
const compoundReds      = ref([])  // 选中的红球
const compoundBlues     = ref([])  // 选中的蓝球
const compoundPhase     = ref('idle')  // 'idle' | 'rolling' | 'done'
const compoundMode      = ref('auto') // 'auto' | 'manual'
const compoundCopyToast = ref(false)

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

const confirmingClear = ref(false)
let confirmTimer = null
function clearHistory() {
  if (!confirmingClear.value) {
    confirmingClear.value = true
    confirmTimer = setTimeout(() => { confirmingClear.value = false }, 3000)
    return
  }
  clearTimeout(confirmTimer)
  confirmingClear.value = false
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

/** 根据匹配数估算奖级描述 */
function prizeLabel({ redMatch, blueMatch }) {
  if (redMatch === 6 && blueMatch) return { text: '一等奖', cls: 'prize-1' }
  if (redMatch === 6 && !blueMatch) return { text: '二等奖', cls: 'prize-2' }
  if (redMatch === 5 && blueMatch) return { text: '三等奖', cls: 'prize-3' }
  if (redMatch === 5 && !blueMatch) return { text: '四等奖', cls: 'prize-4' }
  if (redMatch === 4 && blueMatch) return { text: '四等奖', cls: 'prize-4' }
  if (redMatch === 4 && !blueMatch) return { text: '五等奖', cls: 'prize-5' }
  if (redMatch === 3 && blueMatch) return { text: '五等奖', cls: 'prize-5' }
  if (redMatch === 2 && blueMatch) return { text: '六等奖', cls: 'prize-6' }
  if (redMatch === 1 && blueMatch) return { text: '六等奖', cls: 'prize-6' }
  if (redMatch === 0 && blueMatch) return { text: '六等奖', cls: 'prize-6' }
  return { text: '未中奖', cls: 'prize-none' }
}

// ══════════════════════════════════════════
//  辅助函数
// ══════════════════════════════════════════
const isValid = computed(() => {
  const n = Number(groupCount.value)
  return Number.isInteger(n) && n >= 1 && n <= 10
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
  inputCollapsed.value = true   // 摇完后折叠输入区
  saveHistory(results.value)    // B1
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
//  复式摇号逻辑
// ══════════════════════════════════════════
/** 阶乘（用于组合数计算的辅助） */
function factorial(n) {
  if (n <= 1) return 1
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

/** 组合数 C(n, k) */
function comb(n, k) {
  if (k > n || k < 0) return 0
  if (k === 0 || k === n) return 1
  // 使用约分避免溢出
  let result = 1
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1)
  }
  return Math.round(result)
}

/** 复式注数 = C(redCount, 6) × C(blueCount, 1) */
const compoundBetCount = computed(() => {
  return comb(compoundReds.value.length, 6) * comb(compoundBlues.value.length, 1)
})

/** 复式金额 = 注数 × 2 */
const compoundCost = computed(() => compoundBetCount.value * 2)

/** 手动选择/取消红球 */
function toggleCompoundRed(n) {
  const idx = compoundReds.value.indexOf(n)
  if (idx >= 0) {
    compoundReds.value.splice(idx, 1)
  } else if (compoundReds.value.length < compoundRedCount.value) {
    compoundReds.value.push(n)
    compoundReds.value.sort((a, b) => a - b)
  }
}

/** 手动选择/取消蓝球 */
function toggleCompoundBlue(n) {
  const idx = compoundBlues.value.indexOf(n)
  if (idx >= 0) {
    compoundBlues.value.splice(idx, 1)
  } else if (compoundBlues.value.length < compoundBlueCount.value) {
    compoundBlues.value.push(n)
    compoundBlues.value.sort((a, b) => a - b)
  }
}

/** 自动随机选择复式号码 */
async function doCompoundShake() {
  if (compoundPhase.value === 'rolling') return
  compoundPhase.value = 'rolling'
  compoundReds.value = []
  compoundBlues.value = []
  await nextTick()
  await new Promise(r => setTimeout(r, 300))

  // 随机选 N 个红球
  const redPool = Array.from({ length: 33 }, (_, i) => i + 1)
  const pickedReds = pickRandom(redPool, compoundRedCount.value).sort((a, b) => a - b)
  compoundReds.value = pickedReds

  await new Promise(r => setTimeout(r, 200))

  // 随机选 M 个蓝球
  const bluePool = Array.from({ length: 16 }, (_, i) => i + 1)
  const pickedBlues = pickRandom(bluePool, compoundBlueCount.value).sort((a, b) => a - b)
  compoundBlues.value = pickedBlues

  compoundPhase.value = 'done'
}

/** 清空复式选择 */
function clearCompound() {
  compoundReds.value = []
  compoundBlues.value = []
  compoundPhase.value = 'idle'
}

/** 复制复式结果 */
function copyCompound() {
  if (!compoundReds.value.length && !compoundBlues.value.length) return
  const redText = compoundReds.value.map(formatBall).join(' ')
  const blueText = compoundBlues.value.map(formatBall).join(' ')
  const text = `复式 ${compoundReds.value.length}+${compoundBlues.value.length}\n红球: ${redText}\n蓝球: ${blueText}\n共 ${compoundBetCount.value} 注 / ¥${compoundCost.value}`
  navigator.clipboard?.writeText(text).catch(() => {})
  compoundCopyToast.value = true
  setTimeout(() => { compoundCopyToast.value = false }, 1800)
}

/** 调整 N 红球数时自动裁剪已选 */
function setCompoundRedCount(val) {
  compoundRedCount.value = Math.max(6, Math.min(20, val))
  if (compoundReds.value.length > compoundRedCount.value) {
    compoundReds.value = compoundReds.value.slice(0, compoundRedCount.value)
  }
}

/** 调整 M 蓝球数时自动裁剪已选 */
function setCompoundBlueCount(val) {
  compoundBlueCount.value = Math.max(1, Math.min(16, val))
  if (compoundBlues.value.length > compoundBlueCount.value) {
    compoundBlues.value = compoundBlues.value.slice(0, compoundBlueCount.value)
  }
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
      <button class="tab-btn" :class="{ active: activeTab === 'shake' }"    @click="activeTab = 'shake'">🎰 单式</button>
      <button class="tab-btn" :class="{ active: activeTab === 'compound' }" @click="activeTab = 'compound'">🎯 复式</button>
      <button class="tab-btn" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">⚙️ 筛选</button>
      <button class="tab-btn" :class="{ active: activeTab === 'history' }"  @click="activeTab = 'history'">📋 历史</button>
    </div>

    <!-- ████ 摇号 Tab ████ -->
    <template v-if="activeTab === 'shake'">

      <!-- 单一输入卡：通过 .compact 类触发 grid 压缩动效，全功能保留 -->
      <section class="input-card" :class="{ compact: inputCollapsed && phase === 'done' }">

        <!-- ── 永远可见的控制条（两种状态下均在） ── -->
        <div class="ctrl-bar">
          <!-- 注数步进器 -->
          <div class="qty-stepper">
            <button class="qty-mini-btn" @click="groupCount = Math.max(1, Number(groupCount) - 1)">−</button>
            <span class="qty-display">{{ groupCount }}<small>注</small></span>
            <button class="qty-mini-btn" @click="groupCount = Math.min(10, Number(groupCount) + 1)">+</button>
          </div>

          <!-- 模式快捷图标（紧凑态更明显） -->
          <div class="mode-chips">
            <button class="mode-chip" :class="{ 'mc-on': rollMode }"
              @click="rollMode = !rollMode" title="倒计时搅机">⏱</button>
            <button class="mode-chip" :class="{ 'mc-on': shakeEnabled }"
              @click="shakeEnabled ? disableShake() : enableShake()" title="摇一摇">📳</button>
            <button class="mode-chip" :class="{ 'mc-on': noConsecutive }"
              @click="noConsecutive = !noConsecutive" title="过滤连号">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block">
                <path d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 .77 1.64L14 12.59V19a1 1 0 0 1-.45.832l-4 2.667A1 1 0 0 1 8 21.6V12.59L3.23 5.64A1 1 0 0 1 3 4z"/>
              </svg>
            </button>
            <button v-if="excludeReds.size || pinnedReds.size || excludeBlues.size"
              class="mode-chip mc-filter" @click="clearAllFilters" title="已有号码筛选（点击清除）">
              🎯{{ pinnedReds.size + excludeReds.size + excludeBlues.size }}
            </button>
          </div>

          <!-- 摇号按钮（紧凑态为小胶囊，展开态全宽） -->
          <button class="ctrl-shake-btn"
            :class="{ loading: phase === 'rolling' || phase === 'countdown' }"
            :disabled="!isValid || phase === 'rolling' || phase === 'countdown'"
            @click="doShake">
            <Transition name="count-flip" mode="out-in">
              <span v-if="phase === 'countdown'" :key="countdown" class="countdown-num-sm">{{ countdown }}</span>
              <span v-else-if="phase === 'rolling'">🎰</span>
              <span v-else>🎉 摇号</span>
            </Transition>
          </button>

          <!-- 展开/收起小箭头（摇完后显示） -->
          <button v-if="phase === 'done'" class="chevron-btn"
            @click="inputCollapsed = !inputCollapsed"
            :title="inputCollapsed ? '展开设置' : '收起设置'">
            <span class="chevron-icon" :style="{ transform: inputCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }">⌄</span>
          </button>
        </div>

        <!-- ── 可折叠详细设置（grid-template-rows 动效） ── -->
        <div class="ctrl-body">
          <div class="ctrl-body-inner">
            <!-- 筛选摘要 -->
            <div v-if="excludeReds.size || pinnedReds.size || excludeBlues.size || noConsecutive" class="filter-summary">
              <span v-if="pinnedReds.size"   class="fs-tag pin-tag">📌 固定 {{ pinnedReds.size }} 个红球</span>
              <span v-if="excludeReds.size"  class="fs-tag ex-tag">🚫 排除 {{ excludeReds.size }} 个红球</span>
              <span v-if="excludeBlues.size" class="fs-tag ex-tag">🚫 排除 {{ excludeBlues.size }} 个蓝球</span>
              <span v-if="noConsecutive"     class="fs-tag con-tag">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-1px;margin-right:3px"><path d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 .77 1.64L14 12.59V19a1 1 0 0 1-.45.832l-4 2.667A1 1 0 0 1 8 21.6V12.59L3.23 5.64A1 1 0 0 1 3 4z"/></svg>过滤连号</span>
              <button class="fs-clear" @click="clearAllFilters">清除全部</button>
            </div>

            <!-- D4 倒计时开关 -->
            <label class="toggle-row" for="roll-mode-toggle">
              <span class="toggle-label">⏱ 倒计时搅机模式</span>
              <span class="toggle-wrap">
                <input id="roll-mode-toggle" type="checkbox" v-model="rollMode" class="toggle-input" />
                <span class="toggle-track" :class="{ on: rollMode }"><span class="toggle-thumb"></span></span>
              </span>
            </label>

            <!-- D2 摇一摇开关 -->
            <label class="toggle-row" for="shake-toggle" style="cursor:default">
              <span class="toggle-label">📳 摇一摇触发摇号</span>
              <button id="shake-toggle" class="shake-toggle-btn" :class="{ active: shakeEnabled }"
                @click="shakeEnabled ? disableShake() : enableShake()">
                {{ shakeEnabled ? '已开启' : '开启' }}
              </button>
            </label>
            <Transition name="tip-fade">
              <p v-if="shakeHint === 'granted'"          class="shake-hint success">✅ 摇一摇已开启</p>
              <p v-else-if="shakeHint === 'denied'"      class="shake-hint warn">⚠️ 权限被拒绝，请在系统设置中允许</p>
              <p v-else-if="shakeHint === 'unsupported'" class="shake-hint warn">⚠️ 当前设备不支持此功能</p>
            </Transition>

            <p class="input-hint" style="margin-top:4px">1 ~ 10 注 | 更多筛选见"号码筛选"</p>
          </div>
        </div>

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
          <div class="compare-title-row">
            <p class="compare-title">📊 与近期开奖对比</p>
            <span class="compare-sub">对号颜色越深 = 匹配越多</span>
          </div>

          <!-- 每一期单独一块，纵向排列 -->
          <div v-for="draw in recentDraws" :key="draw.code" class="compare-draw-block">
            <!-- 期号行 -->
            <div class="compare-draw-head">
              <span class="compare-draw-code">第 {{ draw.code }} 期</span>
              <span class="compare-draw-date">{{ draw.date }}</span>
              <!-- 开奖号 -->
              <div class="compare-draw-balls">
                <span v-for="r in draw.reds" :key="r" class="cmp-ball cmp-red">{{ r }}</span>
                <span class="cmp-ball cmp-blue">{{ draw.blue }}</span>
              </div>
            </div>

            <!-- 每注对比行 -->
            <div v-for="(row, idx) in results.filter(r => r.revealed)" :key="idx" class="compare-row-item">
              <span class="compare-row-label">第{{ row.index }}注</span>
              <div class="compare-balls-wrap">
                <!-- 红球：命中高亮 -->
                <span
                  v-for="(r, bi) in row.reds" :key="bi"
                  class="cmp-ball cmp-red"
                  :class="{ 'cmp-hit': draw.reds.includes(formatBall(r)) }"
                >{{ formatBall(r) }}</span>
                <!-- 蓝球：命中高亮 -->
                <span
                  class="cmp-ball cmp-blue"
                  :class="{ 'cmp-hit-blue': formatBall(row.blue) === draw.blue }"
                >{{ formatBall(row.blue) }}</span>
              </div>
              <!-- 奖级徽章 -->
              <span class="prize-tag" :class="prizeLabel(matchCount(row, draw)).cls">
                {{ prizeLabel(matchCount(row, draw)).text }}
              </span>
            </div>
          </div>

          <p class="compare-hint">以上为历史 {{ recentDraws.length }} 期开奖 · 仅供娱乐参考，不构成购彩建议</p>
        </div>
        <div v-else-if="shook && compareLoading" class="compare-loading">
          <p class="state-text">正在对比历史开奖...</p>
        </div>
      </section>
    </template>

    <!-- ████ 复式摇号 Tab ████ -->
    <template v-if="activeTab === 'compound'">
      <section class="compound-card">
        <!-- 标题与模式切换 -->
        <div class="compound-header">
          <h2 class="compound-title">🎯 复式选号</h2>
          <div class="compound-mode-switch">
            <button class="cmode-btn" :class="{ active: compoundMode === 'auto' }"  @click="compoundMode = 'auto'">随机</button>
            <button class="cmode-btn" :class="{ active: compoundMode === 'manual' }" @click="compoundMode = 'manual'">手选</button>
          </div>
        </div>

        <!-- N+M 步进器 -->
        <div class="compound-steppers">
          <div class="compound-stepper">
            <span class="cs-label"><span class="rule-badge red-badge">红球</span></span>
            <div class="cs-ctrl">
              <button class="cs-btn" @click="setCompoundRedCount(compoundRedCount - 1)" :disabled="compoundRedCount <= 6">−</button>
              <span class="cs-value">{{ compoundRedCount }}</span>
              <button class="cs-btn" @click="setCompoundRedCount(compoundRedCount + 1)" :disabled="compoundRedCount >= 20">+</button>
            </div>
            <span class="cs-range">6~20</span>
          </div>
          <div class="compound-stepper">
            <span class="cs-label"><span class="rule-badge blue-badge">蓝球</span></span>
            <div class="cs-ctrl">
              <button class="cs-btn" @click="setCompoundBlueCount(compoundBlueCount - 1)" :disabled="compoundBlueCount <= 1">−</button>
              <span class="cs-value">{{ compoundBlueCount }}</span>
              <button class="cs-btn" @click="setCompoundBlueCount(compoundBlueCount + 1)" :disabled="compoundBlueCount >= 16">+</button>
            </div>
            <span class="cs-range">1~16</span>
          </div>
        </div>

        <!-- 手选模式：球选择面板 -->
        <template v-if="compoundMode === 'manual'">
          <div class="compound-pick-section">
            <p class="compound-pick-label">选 <strong>{{ compoundRedCount }}</strong> 个红球（已选 {{ compoundReds.length }}）</p>
            <div class="ball-picker">
              <button
                v-for="n in 33" :key="n"
                class="pick-ball"
                :class="{
                  'pick-normal': !compoundReds.includes(n),
                  'pick-compound-selected': compoundReds.includes(n),
                  'pick-compound-full': !compoundReds.includes(n) && compoundReds.length >= compoundRedCount,
                }"
                @click="toggleCompoundRed(n)"
              >{{ formatBall(n) }}</button>
            </div>
          </div>

          <div class="compound-pick-section">
            <p class="compound-pick-label">选 <strong>{{ compoundBlueCount }}</strong> 个蓝球（已选 {{ compoundBlues.length }}）</p>
            <div class="ball-picker">
              <button
                v-for="n in 16" :key="n"
                class="pick-ball pick-blue-ball"
                :class="{
                  'pick-normal-blue': !compoundBlues.includes(n),
                  'pick-compound-blue-selected': compoundBlues.includes(n),
                  'pick-compound-full': !compoundBlues.includes(n) && compoundBlues.length >= compoundBlueCount,
                }"
                @click="toggleCompoundBlue(n)"
              >{{ formatBall(n) }}</button>
            </div>
          </div>
        </template>

        <!-- 自动模式：摇号按钮 -->
        <template v-if="compoundMode === 'auto'">
          <button
            class="compound-shake-btn"
            :class="{ loading: compoundPhase === 'rolling' }"
            :disabled="compoundPhase === 'rolling'"
            @click="doCompoundShake"
          >
            <span v-if="compoundPhase === 'rolling'">🎰 摇号中...</span>
            <span v-else>🎉 随机 {{ compoundRedCount }}+{{ compoundBlueCount }} 复式</span>
          </button>
        </template>

        <!-- 结果展示 -->
        <div v-if="compoundReds.length || compoundBlues.length" class="compound-result">
          <div class="compound-result-header">
            <span class="compound-result-tag">复式 {{ compoundReds.length }}+{{ compoundBlues.length }}</span>
            <Transition name="tip-fade">
              <span v-if="compoundCopyToast" class="copy-toast">✅ 已复制</span>
              <button v-else class="copy-btn" @click="copyCompound">复制</button>
            </Transition>
          </div>

          <!-- 选中的红球 -->
          <div class="compound-balls-display">
            <div class="ball-group">
              <span v-for="r in compoundReds" :key="r" class="ball red ball-fly-in"
                :style="{ animationDelay: `${compoundReds.indexOf(r) * 40}ms` }"
              >{{ formatBall(r) }}</span>
            </div>
            <div class="compound-blue-group">
              <span v-for="b in compoundBlues" :key="b" class="ball blue ball-fly-in"
                :style="{ animationDelay: `${(compoundReds.length + compoundBlues.indexOf(b)) * 40}ms` }"
              >{{ formatBall(b) }}</span>
            </div>
          </div>

          <!-- 注数与金额 -->
          <div class="compound-stats">
            <div class="compound-stat-item">
              <span class="csi-label">注数</span>
              <span class="csi-value">{{ compoundBetCount.toLocaleString() }} <small>注</small></span>
            </div>
            <div class="compound-stat-divider"></div>
            <div class="compound-stat-item">
              <span class="csi-label">金额</span>
              <span class="csi-value csi-price">¥{{ compoundCost.toLocaleString() }}</span>
            </div>
          </div>

          <button class="compound-clear-btn" @click="clearCompound">🗑 清空重选</button>
        </div>

        <!-- 空状态提示 -->
        <div v-else-if="compoundMode === 'manual'" class="compound-empty">
          <p>👆 请在上方选择号码</p>
        </div>

        <p class="compound-formula-hint">
          组合公式：C({{ compoundRedCount }},6) × C({{ compoundBlueCount }},1) = {{ comb(compoundRedCount, 6) * comb(compoundBlueCount, 1) }} 注
        </p>
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
          <span style="display:flex;align-items:center;gap:5px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 .77 1.64L14 12.59V19a1 1 0 0 1-.45.832l-4 2.667A1 1 0 0 1 8 21.6V12.59L3.23 5.64A1 1 0 0 1 3 4z"/></svg>
            连号过滤
          </span>
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
          <button v-if="shakeHistory.length"
            class="copy-btn danger-btn"
            :class="{ 'confirm-active': confirmingClear }"
            @click="clearHistory">
            {{ confirmingClear ? '再点确认清空' : '清空' }}
          </button>
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
.rule-text { margin:0; font-size:14px; color:#4a3020; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.rule-badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:13px; font-weight:700; color:#fff; }
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
  flex: 1; padding: 9px 4px; border: none; border-radius: 10px;
  background: transparent; font-size: 13px; font-weight: 600; color: #a08060;
  cursor: pointer; transition: all .18s; white-space: nowrap;
}
.tab-btn.active { background: linear-gradient(135deg,#f06000,#f5a623); color: #fff; box-shadow: 0 3px 10px rgba(240,96,0,.28); }

/* ══ Input card（squeeze 挤压动效版）══ */
.input-card {
  background: rgba(255,255,255,.88);
  border: 1px solid #ffe0c0;
  border-radius: 16px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 0;
  box-shadow: 0 6px 20px rgba(240,96,0,.08);
  /* 卡片整体：padding/border/shadow 平滑过渡 */
  transition:
    padding       0.45s cubic-bezier(0.33, 1, 0.68, 1),
    border-color  0.45s cubic-bezier(0.33, 1, 0.68, 1),
    box-shadow    0.45s cubic-bezier(0.33, 1, 0.68, 1);
  overflow: hidden;
  will-change: transform;
}
.input-card.compact {
  padding: 8px 12px;
  border-color: #f5a623;
  box-shadow: 0 3px 12px rgba(240,96,0,.18);
}

/* ── 控制条（始终可见） ── */
.ctrl-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

/* 注数步进器 */
.qty-stepper {
  display: flex; align-items: center; gap: 4px;
  background: #fff5e8; border: 1.5px solid #f5c080; border-radius: 999px;
  padding: 2px 6px;
  transition: padding 0.4s cubic-bezier(0.33, 1, 0.68, 1);
  flex-shrink: 0;
}
.qty-mini-btn {
  width: 28px; height: 28px; border-radius: 50%;
  border: none; background: transparent; color: #f06000;
  font-size: 20px; font-weight: 700; cursor: pointer; padding: 0;
  display: grid; place-items: center; line-height: 1;
  transition: background .15s;
}
.qty-mini-btn:active { background: rgba(240,96,0,.15); }
.qty-display {
  min-width: 32px; text-align: center;
  font-size: 20px; font-weight: 800; color: #2a1800; line-height: 1;
  transition: font-size 0.4s cubic-bezier(0.33, 1, 0.68, 1);
}
.qty-display small { font-size: 11px; font-weight: 600; color: #b07040; margin-left: 1px; }

/* compact 态步进器微缩 */
.input-card.compact .qty-stepper { padding: 2px 4px; }
.input-card.compact .qty-display  { font-size: 17px; }

/* 模式图标 chip —— 弹性淡入 */
.mode-chips {
  display: flex; align-items: center; gap: 4px;
  flex: 1;
  opacity: 0;
  transform: scale(0.7) translateX(-6px);
  pointer-events: none;
  transition:
    opacity   0.38s cubic-bezier(0.34, 1.4, 0.64, 1),
    transform 0.38s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.input-card.compact .mode-chips {
  opacity: 1;
  transform: scale(1) translateX(0);
  pointer-events: auto;
}
.mode-chip {
  width: 30px; height: 30px; border-radius: 8px; border: 1.5px solid #e8d8c0;
  background: #fff8f0; font-size: 14px; cursor: pointer;
  display: grid; place-items: center; padding: 0;
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.15s;
}
.mode-chip.mc-on     { background: #fff0d0; border-color: #f5a623; box-shadow: 0 0 0 2px rgba(245,166,35,.3); }
.mode-chip.mc-filter { background: #edfff3; border-color: #3aaa60; }
.mode-chip:active    { transform: scale(.85); }

/* 摇号按钮 */
.ctrl-shake-btn {
  flex: 1;
  height: 40px;
  border: none; border-radius: 999px;
  background: linear-gradient(135deg, #f06000, #f5a623);
  color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 14px rgba(240,96,0,.3);
  white-space: nowrap; overflow: hidden;
  transition:
    flex       0.42s cubic-bezier(0.33, 1, 0.68, 1),
    padding    0.42s cubic-bezier(0.33, 1, 0.68, 1),
    font-size  0.42s cubic-bezier(0.33, 1, 0.68, 1),
    background 0.3s ease,
    opacity    0.25s ease;
}
.ctrl-shake-btn:disabled { opacity: .6; cursor: not-allowed; }
.ctrl-shake-btn.loading  { background: linear-gradient(135deg, #c0a060, #e0c090); }
.ctrl-shake-btn:active:not(:disabled) { transform: scale(.96); }
.countdown-num-sm { font-size: 20px; font-weight: 900; line-height: 1; }

/* compact 态按钮收窄 */
.input-card.compact .ctrl-shake-btn {
  flex: 0 0 auto;
  padding: 0 16px;
  font-size: 14px;
}

/* 展开收起箭头 */
.chevron-btn {
  width: 28px; height: 28px; border-radius: 50%;
  border: 1.5px solid #f0d0a0; background: #fff8f0;
  cursor: pointer; display: grid; place-items: center; padding: 0;
  flex-shrink: 0;
  transition: background 0.2s, border-color 0.2s;
}
.chevron-btn:active { background: #f5a623; border-color: #f5a623; }
.chevron-icon {
  font-size: 18px; color: #b07040; display: block; line-height: 1;
  transition: transform 0.42s cubic-bezier(0.33, 1, 0.68, 1);
  /* 初始展开态 = 向下 */
  transform: rotate(0deg);
}
/* compact 时箭头翻转 */
.input-card.compact .chevron-icon { transform: rotate(180deg); }

/* ──────────────────────────────────────────────
   可折叠设置体：核心"挤压"动效
   grid-template-rows: 0fr → 1fr  控制高度收缩
   scaleY: 1 → 0.3  + transform-origin: top center  营造被压扁/弹开感
   ────────────────────────────────────────────── */
.ctrl-body {
  display: grid;
  grid-template-rows: 1fr;
  margin-top: 12px;
  will-change: grid-template-rows, margin-top;
  transition:
    grid-template-rows 0.46s cubic-bezier(0.33, 1, 0.68, 1),
    margin-top         0.40s cubic-bezier(0.33, 1, 0.68, 1);
}
.input-card.compact .ctrl-body {
  grid-template-rows: 0fr;
  margin-top: 0;
}

/* inner：被"压扁"的可见层 */
.ctrl-body-inner {
  overflow: hidden;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding-bottom: 4px;
  transform-origin: top center;
  will-change: transform, opacity;
  transition:
    transform 0.46s cubic-bezier(0.33, 1, 0.68, 1),
    opacity   0.36s cubic-bezier(0.33, 1, 0.68, 1);
  transform: scaleY(1);
  opacity: 1;
}
/* compact 时内容被垂直压扁到 20% + 淡出 */
.input-card.compact .ctrl-body-inner {
  transform: scaleY(0.2);
  opacity: 0;
}

.input-label { font-size: 16px; font-weight: 700; color: #3a2010; }
.input-hint  { margin: 0; font-size: 12px; color: #b07040; }

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
.result-title  { margin:0; font-size:16px; font-weight:700; color:#3a2010; }
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
.row-index { font-size:14px; font-weight:700; color:#b07040; white-space:nowrap; min-width:46px; }

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

/* ══ 折叠条 ══ */
.collapsed-bar {
  background: rgba(255,255,255,.92);
  border: 1.5px solid #f5a623;
  border-radius: 14px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(240,96,0,.12);
  transition: box-shadow .18s;
}
.collapsed-bar:active { box-shadow: 0 2px 6px rgba(240,96,0,.1); }
.collapsed-left  { display:flex; align-items:center; gap:8px; flex-wrap:wrap; min-width:0; }
.collapsed-count { font-size:18px; font-weight:800; color:#f06000; white-space:nowrap; }
.collapsed-actions { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
.collapsed-reshake {
  font-size:13px; padding:6px 14px; border-radius:999px; border:none;
  background:linear-gradient(135deg,#f06000,#f5a623); color:#fff; font-weight:700;
  cursor:pointer; white-space:nowrap; box-shadow:0 3px 10px rgba(240,96,0,.3);
}
.collapsed-expand { font-size:11px; color:#b07040; }

/* ══ C2 对比（新式纵向布局）══ */
.compare-section { margin-top:14px; border-top:1px dashed #f0c090; padding-top:12px; }
.compare-title-row { display:flex; align-items:baseline; gap:8px; margin-bottom:10px; }
.compare-title     { margin:0; font-size:15px; font-weight:700; color:#6a4020; }
.compare-sub       { font-size:11px; color:#b09070; }

.compare-draw-block {
  border: 1px solid #f0d8b0;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 10px;
  background: #fffcf5;
}
.compare-draw-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 10px;
  background: linear-gradient(135deg,#fef3e0,#fff8ec);
  border-bottom: 1px solid #f0d8b0;
}
.compare-draw-code { font-size:13px; font-weight:800; color:#7a4020; white-space:nowrap; }
.compare-draw-date { font-size:11px; color:#b09070; white-space:nowrap; }
.compare-draw-balls { display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-left:auto; }

.compare-row-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-top: 1px solid #f5eedd;
  flex-wrap: wrap;
}
.compare-row-label { font-size:12px; font-weight:700; color:#b07040; min-width:38px; white-space:nowrap; }
.compare-balls-wrap { display:flex; align-items:center; gap:4px; flex-wrap:wrap; flex:1; }

/* 对比专用小球 */
.cmp-ball {
  display:inline-grid; place-items:center;
  width:26px; height:26px; border-radius:50%;
  font-size:11px; font-weight:700; color:#fff;
  opacity:.35;  /* 未命中：半透明 */
}
.cmp-red  { background:linear-gradient(180deg,#ff8888,#e03636); }
.cmp-blue { background:linear-gradient(180deg,#78b0ff,#2a67d8); }
/* 命中时还原不透明 + 发光 */
.cmp-hit      { opacity:1; box-shadow:0 0 0 2px #fff, 0 0 0 4px #e03636; }
.cmp-hit-blue { opacity:1; box-shadow:0 0 0 2px #fff, 0 0 0 4px #2a67d8; }

/* 奖级 Tag */
.prize-tag {
  flex-shrink:0; font-size:11px; font-weight:700; padding:2px 8px;
  border-radius:999px; margin-left:auto; white-space:nowrap;
}
.prize-1 { background:#ffe000; color:#7a4000; }
.prize-2 { background:#ffb300; color:#fff; }
.prize-3 { background:#ff7043; color:#fff; }
.prize-4 { background:#ef5350; color:#fff; }
.prize-5 { background:#e0e0e0; color:#555; }
.prize-6 { background:#f5f5f5; color:#888; }
.prize-none { background:transparent; color:#ccc; font-weight:400; }

.compare-hint { margin:4px 0 0; font-size:10px; color:#b09070; text-align:center; }
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

/* ══ 复式摇号 Tab ══ */
.compound-card {
  background: rgba(255,255,255,.88);
  border: 1px solid #ffe0c0;
  border-radius: 16px;
  padding: 16px 14px;
  box-shadow: 0 6px 20px rgba(240,96,0,.08);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 标题行 */
.compound-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.compound-title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #3a2010;
}

/* 随机/手选 模式切换 */
.compound-mode-switch {
  display: flex;
  gap: 0;
  background: #f5ece0;
  border-radius: 999px;
  padding: 3px;
}
.cmode-btn {
  padding: 5px 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  font-size: 12px;
  font-weight: 700;
  color: #a08060;
  cursor: pointer;
  transition: all .2s;
}
.cmode-btn.active {
  background: linear-gradient(135deg, #f06000, #f5a623);
  color: #fff;
  box-shadow: 0 2px 8px rgba(240,96,0,.25);
}

/* N+M 步进器 */
.compound-steppers {
  display: flex;
  gap: 12px;
}
.compound-stepper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(180deg, #fff, #fff8f0);
  border: 1.5px solid #f0d8b0;
  border-radius: 14px;
}
.cs-label {
  flex-shrink: 0;
}
.cs-ctrl {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  justify-content: center;
}
.cs-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid #e0d0b8;
  background: #fff;
  color: #f06000;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 0;
  line-height: 1;
  transition: all .15s;
}
.cs-btn:disabled {
  opacity: .35;
  cursor: not-allowed;
}
.cs-btn:active:not(:disabled) {
  background: rgba(240,96,0,.12);
  border-color: #f06000;
}
.cs-value {
  font-size: 22px;
  font-weight: 900;
  color: #2a1800;
  min-width: 28px;
  text-align: center;
  line-height: 1;
}
.cs-range {
  font-size: 10px;
  color: #b09070;
  flex-shrink: 0;
}

/* 手选提示 */
.compound-pick-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.compound-pick-label {
  margin: 0;
  font-size: 13px;
  color: #6a4020;
}
.compound-pick-label strong {
  color: #f06000;
  font-size: 15px;
}

/* 手选球的特殊状态 */
.pick-compound-selected {
  background: linear-gradient(180deg, #ff6040, #c02020) !important;
  color: #fff !important;
  border-color: #a01010 !important;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #f06000;
  transform: scale(1.08);
}
.pick-compound-blue-selected {
  background: linear-gradient(180deg, #4090ff, #1a50c0) !important;
  color: #fff !important;
  border-color: #1040a0 !important;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #2a67d8;
  transform: scale(1.08);
}
.pick-compound-full {
  opacity: .35;
  cursor: not-allowed !important;
  pointer-events: none;
}

/* 复式摇号大按钮 */
.compound-shake-btn {
  width: 100%;
  padding: 14px 0;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #f06000 0%, #f5a623 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(240,96,0,.35);
  transition: transform .15s, box-shadow .15s, background .3s;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.compound-shake-btn:active:not(:disabled) {
  transform: scale(.96);
  box-shadow: 0 2px 10px rgba(240,96,0,.25);
}
.compound-shake-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}
.compound-shake-btn.loading {
  background: linear-gradient(135deg, #c0a060, #e0c090);
}

/* 结果展示区 */
.compound-result {
  background: linear-gradient(180deg, #fffcf5, #fff5e8);
  border: 1.5px solid #f5c080;
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.compound-result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.compound-result-tag {
  font-size: 14px;
  font-weight: 800;
  color: #f06000;
  background: #fff0d0;
  padding: 3px 12px;
  border-radius: 999px;
}
.compound-balls-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding: 8px 0;
}
.compound-blue-group {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  padding-top: 4px;
  border-top: 1px dashed #e0d0b8;
}

/* 注数与金额统计 */
.compound-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  background: #fff;
  border: 1px solid #f0d8b0;
  border-radius: 12px;
  overflow: hidden;
}
.compound-stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px;
  gap: 2px;
}
.compound-stat-divider {
  width: 1px;
  height: 36px;
  background: #f0d8b0;
  flex-shrink: 0;
}
.csi-label {
  font-size: 11px;
  color: #a08060;
  font-weight: 500;
}
.csi-value {
  font-size: 20px;
  font-weight: 900;
  color: #3a2010;
  line-height: 1;
}
.csi-value small {
  font-size: 11px;
  font-weight: 600;
  color: #b07040;
  margin-left: 2px;
}
.csi-price {
  color: #e04000;
}

/* 清空按钮 */
.compound-clear-btn {
  width: 100%;
  padding: 10px;
  border: 1.5px solid #ddd;
  border-radius: 999px;
  background: #fff;
  color: #888;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s;
}
.compound-clear-btn:active {
  background: #f5f5f5;
  border-color: #bbb;
  transform: scale(.97);
}

/* 空状态 */
.compound-empty {
  padding: 20px 0;
  text-align: center;
}
.compound-empty p {
  margin: 0;
  font-size: 14px;
  color: #b09070;
}

/* 公式提示 */
.compound-formula-hint {
  margin: 0;
  font-size: 11px;
  color: #b09070;
  text-align: center;
  padding: 4px 0 0;
}
</style>
