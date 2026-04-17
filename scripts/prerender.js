/**
 * 构建后预渲染脚本
 * 为每个路由生成独立的 index.html，包含完整 SEO 标签和语义化静态内容
 * 让搜索引擎爬虫无需执行 JS 即可读取页面核心信息
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(__dirname, '../dist')
const SITE_URL = 'https://ssq.roiwk.cn'

// 路由 SEO 配置
const routes = [
  {
    path: '/',
    outputPath: 'index.html',
    title: '双色球预测 - 多策略智能分析与历史开奖查询',
    description: '双色球多策略智能预测分析平台，基于历史数据统计与机器学习模型，提供多种预测策略结果及历史开奖数据查询。',
    canonical: `${SITE_URL}/`,
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: '双色球预测',
      url: `${SITE_URL}/`,
      description: '双色球多策略智能预测分析平台，基于历史数据统计与机器学习模型，提供多种预测策略结果及历史开奖数据查询。',
      inLanguage: 'zh-CN',
    },
    noscriptContent: `
      <div class="seo-content">
        <h1>双色球预测 - 多策略智能分析</h1>
        <p>欢迎使用双色球多策略智能预测分析平台。本平台基于历史数据统计与机器学习模型，提供多种预测策略结果。</p>
        <h2>平台功能</h2>
        <ul>
          <li><strong>多策略预测</strong> - 多种统计与机器学习策略综合分析，为下期双色球提供预测参考号码</li>
          <li><strong>历史开奖查询</strong> - 查看双色球全部历史开奖号码、奖级详情、销售额与奖池数据</li>
          <li><strong>随机摇号</strong> - 按双色球规则（红球01~33选6，蓝球01~16选1）随机生成号码，支持单式/复式</li>
        </ul>
        <h2>双色球规则</h2>
        <p>中国福利彩票双色球：从01-33中选取6个红色球号码，从01-16中选取1个蓝色球号码组成一注进行投注。</p>
        <nav>
          <a href="/">预测首页</a> |
          <a href="/history">历史开奖</a> |
          <a href="/lucky">随机摇号</a>
        </nav>
        <p><em>本站预测结果仅供参考，不构成任何购彩建议。理性购彩，量力而行。</em></p>
      </div>`,
    appSkeletonContent: `
      <main class="page home-page">
        <header class="home-header"><div><h1 class="page-title">🎯 双色球预测</h1><p class="page-subtitle">多策略结果一览</p></div></header>
        <section class="content-card"><p class="state-text">正在加载预测结果...</p></section>
      </main>`,
  },
  {
    path: '/history',
    outputPath: 'history/index.html',
    title: '历史开奖查询 - 双色球预测',
    description: '查询双色球全部历史开奖号码，包含红球蓝球号码、各奖级中奖注数与金额、销售额及奖池滚存数据，支持分页浏览。',
    canonical: `${SITE_URL}/history`,
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: '双色球历史开奖查询',
      url: `${SITE_URL}/history`,
      description: '查询双色球全部历史开奖号码，包含红球蓝球号码、各奖级中奖注数与金额、销售额及奖池滚存数据。',
      inLanguage: 'zh-CN',
      isPartOf: {
        '@type': 'WebSite',
        name: '双色球预测',
        url: `${SITE_URL}/`,
      },
    },
    noscriptContent: `
      <div class="seo-content">
        <h1>双色球历史开奖查询</h1>
        <p>在此页面可以浏览中国福利彩票双色球的全部历史开奖记录，包括：</p>
        <ul>
          <li>每期开奖的红球和蓝球号码</li>
          <li>各奖级（一等奖至六等奖）中奖注数与单注奖金</li>
          <li>当期销售总额</li>
          <li>奖池滚存金额</li>
        </ul>
        <p>数据支持分页浏览，持续更新。</p>
        <nav>
          <a href="/">预测首页</a> |
          <a href="/history">历史开奖</a> |
          <a href="/lucky">随机摇号</a>
        </nav>
      </div>`,
    appSkeletonContent: `
      <main class="page history-page">
        <header class="history-header"><div class="history-title-block"><h1 class="page-title">📅 历史开奖</h1></div></header>
        <section class="history-content"><p class="state-text">正在加载历史开奖...</p></section>
      </main>`,
  },
  {
    path: '/lucky',
    outputPath: 'lucky/index.html',
    title: '随机摇号 - 双色球号码生成器',
    description: '双色球随机号码生成器，支持单式摇号（1~10注）和复式选号，可设置排除号码、固定号码、过滤连号等条件，前端本地生成。',
    canonical: `${SITE_URL}/lucky`,
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: '双色球随机摇号',
      url: `${SITE_URL}/lucky`,
      description: '双色球随机号码生成器，支持单式摇号和复式选号，可设置排除号码、固定号码、过滤连号等条件。',
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      inLanguage: 'zh-CN',
      isPartOf: {
        '@type': 'WebSite',
        name: '双色球预测',
        url: `${SITE_URL}/`,
      },
    },
    noscriptContent: `
      <div class="seo-content">
        <h1>双色球随机摇号</h1>
        <p>双色球随机号码生成器，完全在浏览器本地运行，支持以下功能：</p>
        <h2>单式摇号</h2>
        <ul>
          <li>按双色球规则（红球01~33选6个，蓝球01~16选1个）随机生成</li>
          <li>支持1~10注批量生成</li>
          <li>可排除指定号码、固定号码、过滤连号</li>
          <li>摇一摇触发（移动设备）</li>
        </ul>
        <h2>复式选号</h2>
        <ul>
          <li>自定义红球数量（6~20个）和蓝球数量（1~16个）</li>
          <li>支持手动选号和随机选号</li>
          <li>自动计算注数与投注金额</li>
        </ul>
        <h2>更多功能</h2>
        <ul>
          <li>摇号历史记录（本地存储）</li>
          <li>与近期开奖号码对比</li>
          <li>一键复制结果</li>
        </ul>
        <nav>
          <a href="/">预测首页</a> |
          <a href="/history">历史开奖</a> |
          <a href="/lucky">随机摇号</a>
        </nav>
      </div>`,
    appSkeletonContent: `
      <main class="page lucky-page">
        <header class="lucky-header"><div><h1 class="page-title">随机摇号</h1><p class="page-subtitle">双色球随机号码生成器</p></div></header>
        <section class="rule-card"><p class="rule-text">红球 01~33 选6个 蓝球 01~16 选1个</p></section>
      </main>`,
  },
]

// BreadcrumbList JSON-LD
function buildBreadcrumb(route) {
  const items = [
    { '@type': 'ListItem', position: 1, name: '首页', item: `${SITE_URL}/` },
  ]
  if (route.path === '/history') {
    items.push({ '@type': 'ListItem', position: 2, name: '历史开奖', item: `${SITE_URL}/history` })
  } else if (route.path === '/lucky') {
    items.push({ '@type': 'ListItem', position: 2, name: '随机摇号', item: `${SITE_URL}/lucky` })
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

/**
 * 从模板中剥离所有已有的 SEO 相关标签，生成干净的骨架
 * 这样预渲染注入时不会产生重复标签
 */
function stripExistingSEO(html) {
  // 移除已有的 meta description, keywords, author, robots, theme-color
  html = html.replace(/<meta\s+name="(description|keywords|author|robots|theme-color)"[^>]*\/?\s*>\s*/gi, '')
  // 移除已有的 OG meta
  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?\s*>\s*/gi, '')
  // 移除已有的 Twitter meta
  html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?\s*>\s*/gi, '')
  // 移除已有的 canonical link
  html = html.replace(/<link\s+rel="canonical"[^>]*\/?\s*>\s*/gi, '')
  // 移除已有的 JSON-LD script blocks
  html = html.replace(/<script\s+type="application\/ld\+json"[\s\S]*?<\/script>\s*/gi, '')
  // 移除 HTML 注释块标题（<!-- SEO Meta --> 等）
  html = html.replace(/<!--\s*(SEO Meta|Open Graph|Twitter Card|Misc SEO|JSON-LD Structured Data)\s*-->\s*/gi, '')
  // 移除已有的 GitHub Pages SPA support 脚本（带注释的那段）
  html = html.replace(/<!--\s*GitHub Pages SPA support[^>]*-->\s*<script>[\s\S]*?<\/script>\s*/gi, '')
  // 移除已有的 noscript 块
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>\s*/gi, '')
  // 清空 <div id="app"> 内的骨架内容，只保留空的 app div
  html = html.replace(/<div id="app">[\s\S]*?<\/div>/, '<div id="app"></div>')
  return html
}

function processRoute(cleanTemplate, route) {
  let html = cleanTemplate

  // 1. 替换 <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${route.title}</title>`)

  // 2. 在 </head> 前注入完整 SEO meta
  const seoMeta = `
    <!-- SEO Meta -->
    <meta name="description" content="${route.description}" />
    <meta name="keywords" content="双色球,双色球预测,SSQ,彩票分析,历史开奖,开奖查询,多策略预测,随机摇号" />
    <meta name="author" content="roiwk" />
    <link rel="canonical" href="${route.canonical}" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#2f5fe7" />

    <!-- Open Graph -->
    <meta property="og:type" content="${route.ogType}" />
    <meta property="og:title" content="${route.title}" />
    <meta property="og:description" content="${route.description}" />
    <meta property="og:url" content="${route.canonical}" />
    <meta property="og:site_name" content="双色球预测" />
    <meta property="og:locale" content="zh_CN" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${route.title}" />
    <meta name="twitter:description" content="${route.description}" />

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">${JSON.stringify(route.jsonLd)}</script>
    <script type="application/ld+json">${JSON.stringify(buildBreadcrumb(route))}</script>

    <!-- GitHub Pages SPA support: restore route from 404.html redirect -->
    <script>
      (function(l) {
        if (l.search[1] === '/') {
          var decoded = l.search.slice(1).split('&').map(function(s) {
            return s.replace(/~and~/g, '&')
          }).join('?');
          window.history.replaceState(null, null,
            l.pathname.slice(0, -1) + decoded + l.hash
          );
        }
      }(window.location))
    </script>`

  html = html.replace('</head>', `${seoMeta}\n  </head>`)

  // 3. 替换 <body> 内容：noscript + div#app（一次性替换，避免嵌套 div 的 regex 问题）
  const bodyContent = `
    <noscript>${route.noscriptContent}
    </noscript>
    <div id="app">${route.appSkeletonContent}
    </div>`

  html = html.replace(
    /<body>[\s\S]*<\/body>/,
    `<body>${bodyContent}\n  </body>`
  )

  return html
}

// ── 执行 ──
console.log('🔧 开始预渲染 SEO 页面...\n')

const templatePath = resolve(DIST, 'index.html')
if (!existsSync(templatePath)) {
  console.error('❌ dist/index.html 不存在，请先运行 vite build')
  process.exit(1)
}

const rawTemplate = readFileSync(templatePath, 'utf-8')

// 先剥离所有已有 SEO 标签，生成干净模板
const cleanTemplate = stripExistingSEO(rawTemplate)

for (const route of routes) {
  const outputFile = resolve(DIST, route.outputPath)
  const outputDir = dirname(outputFile)

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const html = processRoute(cleanTemplate, route)
  writeFileSync(outputFile, html, 'utf-8')

  console.log(`  ✅ ${route.path} → dist/${route.outputPath}`)
}

console.log('\n🎉 预渲染完成！')
