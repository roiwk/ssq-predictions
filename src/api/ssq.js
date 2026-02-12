const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '')

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  // 仅在有请求体时才设置 Content-Type，避免 GET 请求触发不必要的 CORS preflight
  if (options.body) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...options,
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  const payload = await response.json()
  if (typeof payload?.code === 'number' && payload.code !== 0) {
    throw new Error(payload.message || 'Request business error')
  }
  if (typeof payload?.state === 'number' && payload.state !== 0) {
    throw new Error(payload.message || 'Request business error')
  }
  return payload
}

export function fetchPredictionResult() {
  return request('/ssq/predictions/latest').then((payload) => payload?.data || payload)
}

export function fetchHistoryDraws(params = {}) {
  const query = new URLSearchParams({
    pageNo: String(params.pageNo || 1),
    pageSize: String(params.pageSize || 30),
  })
  return request(`/ssq/history?${query.toString()}`).then((payload) => payload?.data || payload)
}

export { API_BASE_URL }
