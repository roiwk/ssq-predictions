const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '')

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
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
