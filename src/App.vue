<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <div id="app-shell">
    <router-view />
    <nav class="bottom-nav" role="navigation" aria-label="主导航">
      <router-link class="nav-item" to="/" :class="{ active: route.name === 'home' }">
        <span class="nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12L12 4l9 8" />
            <path d="M9 21V12h6v9" />
          </svg>
        </span>
        <span class="nav-label">预测</span>
      </router-link>
      <router-link class="nav-item" to="/history" :class="{ active: route.name === 'history' }">
        <span class="nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 15" />
          </svg>
        </span>
        <span class="nav-label">历史</span>
      </router-link>
      <router-link class="nav-item" to="/lucky" :class="{ active: route.name === 'lucky' }">
        <span class="nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="4" ry="4"/>
            <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </span>
        <span class="nav-label">摇号</span>
      </router-link>
    </nav>
  </div>
</template>

<style>
#app-shell {
  width: 100%;
  position: relative;
}

/* 所有 .page 都给底部导航留出空间 */
.page {
  padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px)) !important;
}

/* ─── 底部导航栏 ─── */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: stretch;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid rgba(210, 220, 255, 0.7);
  box-shadow: 0 -4px 24px rgba(31, 67, 160, 0.10);
  height: calc(60px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  text-decoration: none;
  color: #8a9bc0;
  font-size: 11px;
  font-weight: 500;
  padding: 8px 0 4px;
  transition: color 0.2s, transform 0.15s;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.nav-item:active {
  transform: scale(0.9);
}

.nav-icon {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.nav-icon svg {
  width: 22px;
  height: 22px;
}

.nav-label {
  line-height: 1;
  letter-spacing: 0.02em;
}

/* 激活状态：预测 → 蓝色，历史 → 靛蓝，摇号 → 橙色 */
.nav-item[href="/"].active,
.nav-item.router-link-exact-active:not([href="/history"]):not([href="/lucky"]) {
  color: #2f5fe7;
}

.nav-item[href="/history"].active {
  color: #4b35d8;
}

.nav-item[href="/lucky"].active {
  color: #f06000;
}

/* 通用 active 处理 */
.nav-item.active {
  font-weight: 700;
}

.nav-item.active .nav-icon {
  transform: translateY(-2px);
}

/* 激活指示圆点 */
.nav-item.active .nav-label::after {
  content: '';
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  margin: 3px auto 0;
  background: currentColor;
}
</style>
