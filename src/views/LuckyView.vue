<script setup>
import { ref, computed } from 'vue'

const groupCount = ref(1)
const results = ref([])
const isShaking = ref(false)
const shook = ref(false)

const isValid = computed(() => {
  const n = Number(groupCount.value)
  return Number.isInteger(n) && n >= 1 && n <= 100
})

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateOneLine() {
  const reds = new Set()
  while (reds.size < 6) {
    reds.add(getRandomInt(1, 33))
  }
  const blue = getRandomInt(1, 16)
  return {
    reds: Array.from(reds).sort((a, b) => a - b),
    blue,
  }
}

function formatBall(num) {
  return String(num).padStart(2, '0')
}

async function doShake() {
  if (!isValid.value || isShaking.value) return
  isShaking.value = true
  shook.value = false
  results.value = []

  // 动画延迟体感
  await new Promise((r) => setTimeout(r, 480))

  const count = Number(groupCount.value)
  results.value = Array.from({ length: count }, (_, i) => ({
    index: i + 1,
    ...generateOneLine(),
  }))

  isShaking.value = false
  shook.value = true
}

function copyAll() {
  if (!results.value.length) return
  const text = results.value
    .map(
      (r) =>
        `第${r.index}注: 红球 ${r.reds.map(formatBall).join(' ')}  蓝球 ${formatBall(r.blue)}`,
    )
    .join('\n')
  navigator.clipboard?.writeText(text).catch(() => {})
}
</script>

<template>
  <main class="page lucky-page">
    <header class="lucky-header">
      <div>
        <h1 class="page-title">随机摇号</h1>
        <p class="page-subtitle">双色球随机号码生成器</p>
      </div>
      <div class="dice-icon" :class="{ spinning: isShaking }">🎲</div>
    </header>

    <!-- 规则说明 -->
    <section class="rule-card">
      <p class="rule-text">
        <span class="rule-badge red-badge">红球</span> 从 01~33 中随机选 6 个 &nbsp;
        <span class="rule-badge blue-badge">蓝球</span> 从 01~16 中随机选 1 个
      </p>
    </section>

    <!-- 输入区域 -->
    <section class="input-card">
      <label class="input-label" for="group-count">需要生成的注数</label>
      <div class="input-row">
        <button class="qty-btn" @click="groupCount = Math.max(1, Number(groupCount) - 1)">−</button>
        <input
          id="group-count"
          v-model.number="groupCount"
          class="qty-input"
          type="number"
          min="1"
          max="100"
          inputmode="numeric"
          pattern="[0-9]*"
        />
        <button class="qty-btn" @click="groupCount = Math.min(100, Number(groupCount) + 1)">+</button>
      </div>
      <p class="input-hint">可输入 1 ~ 100 注</p>

      <button
        class="shake-btn"
        :class="{ loading: isShaking }"
        :disabled="!isValid || isShaking"
        @click="doShake"
      >
        <span v-if="isShaking" class="shake-spinner">⚙</span>
        <span v-else>🎉 开始摇号</span>
      </button>
    </section>

    <!-- 结果区域 -->
    <section v-if="shook || isShaking" class="result-card">
      <div class="result-header">
        <p class="result-title">摇号结果</p>
        <button v-if="results.length > 0" class="copy-btn" @click="copyAll">复制全部</button>
      </div>

      <div v-if="isShaking" class="shaking-placeholder">
        <div class="ball-anim">
          <span v-for="i in 6" :key="i" class="ball red anim-ball" :style="{ animationDelay: `${i * 0.08}s` }">?</span>
          <span class="ball blue anim-ball" style="animation-delay: 0.55s">?</span>
        </div>
        <p class="state-text">摇号中...</p>
      </div>

      <ul v-else class="result-list">
        <li
          v-for="row in results"
          :key="row.index"
          class="result-row"
          :style="{ animationDelay: `${(row.index - 1) * 0.06}s` }"
        >
          <span class="row-index">第 {{ row.index }} 注</span>
          <div class="balls-row">
            <div class="ball-group">
              <span v-for="r in row.reds" :key="r" class="ball red">{{ formatBall(r) }}</span>
            </div>
            <span class="ball blue">{{ formatBall(row.blue) }}</span>
          </div>
        </li>
      </ul>
    </section>

    <!-- 免责 -->
    <footer class="disclaimer">
      <p>摇号结果完全随机，仅供娱乐参考。<strong>理性购彩，量力而行。</strong></p>
    </footer>
  </main>
</template>

<style scoped>
.lucky-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 80px;
}

.lucky-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: linear-gradient(135deg, #f06000 0%, #f5a623 100%);
  border-radius: 16px;
  padding: 14px 12px;
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(240, 96, 0, 0.28);
}

.dice-icon {
  font-size: 40px;
  transition: transform 0.3s;
  transform-origin: center;
}

.dice-icon.spinning {
  animation: dice-spin 0.5s linear infinite;
}

@keyframes dice-spin {
  from { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.2); }
  to { transform: rotate(360deg) scale(1); }
}

.rule-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #ffe0c0;
  border-radius: 14px;
  padding: 10px 14px;
}

.rule-text {
  margin: 0;
  font-size: 13px;
  color: #4a3020;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.rule-badge {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
}

.red-badge { background: linear-gradient(180deg, #ff7272 0%, #e03636 100%); }
.blue-badge { background: linear-gradient(180deg, #6aa5ff 0%, #2a67d8 100%); }

.input-card {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #ffe0c0;
  border-radius: 16px;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-shadow: 0 6px 20px rgba(240, 96, 0, 0.08);
}

.input-label {
  font-size: 15px;
  font-weight: 700;
  color: #3a2010;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.qty-btn {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid #f06000;
  background: #fff;
  color: #f06000;
  font-size: 22px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;
  line-height: 1;
}

.qty-btn:active {
  background: #f06000;
  color: #fff;
  transform: scale(0.93);
}

.qty-input {
  width: 90px;
  height: 52px;
  text-align: center;
  font-size: 28px;
  font-weight: 700;
  color: #2a1800;
  border: 2px solid #f5c080;
  border-radius: 12px;
  background: #fffaf5;
  outline: none;
  -moz-appearance: textfield;
}

.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}

.qty-input:focus {
  border-color: #f06000;
  box-shadow: 0 0 0 3px rgba(240, 96, 0, 0.14);
}

.input-hint {
  margin: 0;
  font-size: 12px;
  color: #b07040;
}

.shake-btn {
  margin-top: 4px;
  width: 100%;
  max-width: 280px;
  padding: 14px 0;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #f06000 0%, #f5a623 100%);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(240, 96, 0, 0.35);
  transition: transform 0.15s, box-shadow 0.15s;
  letter-spacing: 1px;
}

.shake-btn:active:not(:disabled) {
  transform: scale(0.96);
  box-shadow: 0 2px 10px rgba(240, 96, 0, 0.25);
}

.shake-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.shake-btn.loading {
  background: linear-gradient(135deg, #c0a060 0%, #e0c090 100%);
}

.shake-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.result-card {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #ffe0c0;
  border-radius: 16px;
  padding: 14px 12px;
  box-shadow: 0 6px 20px rgba(240, 96, 0, 0.08);
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.result-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #3a2010;
}

.copy-btn {
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid #f5a623;
  background: #fff8f0;
  color: #a06020;
  cursor: pointer;
  transition: all 0.15s;
}

.copy-btn:active {
  background: #f5a623;
  color: #fff;
}

.shaking-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
}

.ball-anim {
  display: flex;
  align-items: center;
  gap: 6px;
}

.anim-ball {
  animation: ball-bounce 0.6s ease infinite alternate;
}

@keyframes ball-bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-10px); }
}

.result-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #fff8f0 100%);
  border: 1px solid #ffe0c0;
  animation: row-in 0.3s ease both;
  flex-wrap: wrap;
}

@keyframes row-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.row-index {
  font-size: 12px;
  font-weight: 700;
  color: #b07040;
  white-space: nowrap;
  min-width: 46px;
}

.disclaimer {
  margin-top: auto;
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.7;
  color: #9a8070;
  background: rgba(255, 255, 255, 0.6);
  border: 1px dashed #f0c090;
  border-radius: 12px;
  text-align: center;
}

.disclaimer p { margin: 0; }

.disclaimer strong { color: #c04040; }
</style>
