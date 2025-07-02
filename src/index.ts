import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { etag } from 'hono/etag'
import { serveStatic } from 'hono/bun'
import { DownloadController } from './resources.service'

const port = 3000
const baseUrl = 'https://sbox.pragmaticpplay.com'
const app = new Hono()

// CORS middleware
app.use(
  '*',
  cors({
    origin: '*'
  })
)

// Routes ที่ต้องการ response เหมือนกัน
app.on(
  'GET',
  [
    '/gs2c/promo/active*',
    '/gs2c/common/v1/games-html5/games/vs/*/desktop/customizations.info*',
    '/gs2c/announcements/unread*',
    '/gs2c/promo/frb/available*',
    '/ClientAPI/events/active*',
  ],
  async c => {
    c.status(200)
    return c.text('')
  }
)
app.on('POST', ['/gs2c/stats.do*'], async c => {
  c.status(200)
  return c.json({ description: 'OK', error: 0, serverTime: Date.now() })
})

app.use(
  '*',
  etag(),
  serveStatic({
    root: './public/games'
  })
)

app.route('', DownloadController(baseUrl))
// Proxy middleware - forward ทุก request ไปยัง baseUrl
app.all('*', async c => {
  try {
    // สร้าง target URL โดยใช้ full URL path และ query string
    const url = new URL(c.req.url)
    const targetUrl = `${baseUrl}${url.pathname}${url.search}`

    // เตรียม headers สำหรับ forward
    const headers = new Headers()

    // วนลูปผ่าน headers ของ request
    for (const [key, value] of Object.entries(c.req.header())) {
      // ไม่ forward host header เพื่อป้องกัน conflict
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value as string)
      }
    }

    // สร้าง request options
    const requestOptions: RequestInit = {
      method: c.req.method,
      headers: headers
    }

    // เพิ่ม body สำหรับ POST, PUT, PATCH methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
      requestOptions.body = await c.req.arrayBuffer()
    }

    // ส่ง request ไปยัง target URL
    const response = await fetch(targetUrl, requestOptions)
    console.log('Target URL:', targetUrl)
    console.log('Method:', c.req.method)
    console.log('Response status:', response.status)

    // สร้าง response headers สำหรับส่งกลับ (ยกเว้น headers ที่อาจจะทำให้เกิดปัญหา)
    const responseHeaders = new Headers()
    response.headers.forEach((value: string, key: string) => {
      // ไม่ copy headers ที่เกี่ยวกับ encoding เพราะ browser จะ handle เอง
      if (
        !['content-encoding', 'content-length', 'transfer-encoding'].includes(
          key.toLowerCase()
        )
      ) {
        responseHeaders.set(key, value)
      }
    })

    // ใช้ Hono response แทน native Response
    const responseBody = await response.arrayBuffer()

    // สร้าง headers object จาก Headers
    const headersObj: Record<string, string> = {}
    responseHeaders.forEach((value, key) => {
      headersObj[key] = value
    })

    return new Response(responseBody, {
      status: response.status,
      headers: headersObj
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return c.json({ error: 'Proxy request failed' }, 500)
  }
})

Bun.serve({
  fetch: app.fetch,
  port: port
})

console.log(`🦊 Proxy Server is running on http://localhost:${port}`)
console.log(`📡 Forwarding all requests to: ${baseUrl}`)
