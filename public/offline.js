(() => {
  const button = document.getElementById('prepareOffline')
  const status = document.getElementById('offlineStatus')
  const workerURL = new URL('./offline-sw.js', location.href).href
  const supported = 'serviceWorker' in navigator && 'caches' in window
  function ready() {
    button.disabled = true
    button.textContent = 'این دستگاه برای بازی آفلاین آماده است'
    status.textContent = 'بدون اینترنت همین صفحه را در همین مرورگر باز کن.'
  }
  if (!supported) {
    button.disabled = true
    failedFile = ''
    status.textContent = 'برای ذخیرهٔ بازی، لینک را در مرورگری با پشتیبانی از بازی آفلاین باز کن.'
    return
  }
  async function check() {
    const reg = await navigator.serviceWorker.getRegistration(location.href)
    if (reg?.active?.scriptURL === workerURL && reg.active.state === 'activated' &&
        await caches.has('khial-local-v2:' + new URL('./', location.href).pathname)) ready()
  }
  let failedFile = ''
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.source?.scriptURL === workerURL && typeof event.data?.offlineFailed === 'string') failedFile = event.data.offlineFailed
  })
  check().catch(() => {})
  button.onclick = async () => {
    button.disabled = true
    failedFile = ''
    status.textContent = 'در حال ذخیرهٔ بازی و ۱۰۴ تصویر کارت… صفحه را تا پایان باز نگه دار.'
    try {
      const reg = await navigator.serviceWorker.register(workerURL)
      const worker = reg.installing || reg.waiting || reg.active
      if (!worker) throw new Error()
      await new Promise((resolve, reject) => {
        function changed() {
          if (!['activated','redundant'].includes(worker.state)) return
          worker.removeEventListener('statechange', changed)
          if (worker.state === 'activated') resolve()
          else reject(new Error())
        }
        worker.addEventListener('statechange', changed)
        changed()
      })
      ready()
    } catch {
      button.disabled = false
      status.textContent = (failedFile ? 'دریافت ' + failedFile + ' کامل نشد. ' : '') + 'ذخیره کامل نشد. اتصال اینترنت و فضای خالی را بررسی کن و دوباره بزن.'
      if (location.hostname === 'nassertvs.github.io') {
        const link = document.createElement('a')
        link.href = 'https://stozhit-mah-khial.leapingknack64.chatgpt.site/game'
        link.textContent = 'ذخیره از نسخهٔ مستقیم بازی'
        status.append(' ', link)
      }
    }
  }
})()
