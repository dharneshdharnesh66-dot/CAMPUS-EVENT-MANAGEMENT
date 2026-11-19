let csrf = ''
async function request(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try { return await fetch(url, { ...options, signal: controller.signal }) }
  catch { throw new Error('Cannot reach the Campus server. Check that the backend is running, then try again.') }
  finally { clearTimeout(timer) }
}
export async function loadSession() {
  const response = await request('/api/session', { credentials: 'same-origin', cache: 'no-store' })
  let data
  try { data = await response.json() } catch { throw new Error('The Campus API is unavailable. Start the backend and open its address, not the Vite-only preview.') }
  if (!response.ok) throw new Error(data.error || 'Cannot load your session.')
  csrf = data.csrf
  return data.user
}
export async function api(path, { method = 'GET', body } = {}) {
  const response = await request(`/api${path}`, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }),
  })
  let data
  try { data = await response.json() } catch { throw new Error('Cannot read the server response. Open the app through the Campus server address.') }
  if (!response.ok) { const error = new Error(data.error || 'The request failed. Try again.'); error.status = response.status; throw error }
  if (data.csrf) csrf = data.csrf
  return data
}
