import { Hono } from 'hono'
import { readFileSync } from 'fs'
import { join } from 'path'
import axios from 'axios'

const app = new Hono()
const baseUrl = 'https://demogamesfree-asia.pragmaticplay.net'

// อ่าน inject script ล่วงหน้า
const injectScript = readFileSync(join(import.meta.dir, 'inject-script.js'), 'utf-8')

// สร้าง axios instance
const axiosInstance = axios.create({
  timeout: 30000,
  maxRedirects: 5,
  validateStatus: () => true // ยอมรับทุก status code
})

// Proxy สำหรับทุก path
app.all('/*', async (c) => {
  const path = c.req.path
  const method = c.req.method.toLowerCase()
  const headers = {}
  
  // คัดลอก headers จาก original request (ยกเว้น host และ headers ที่ axios จัดการ)
  for (const [key, value] of Object.entries(c.req.header())) {
    const lowerKey = key.toLowerCase()
    if (!['host', 'content-length', 'connection'].includes(lowerKey)) {
      headers[key] = value
    }
  }
  
  // สร้าง URL สำหรับ proxy
  const targetUrl = `${baseUrl}${path}`
  const query = c.req.url.split('?')[1]
  const fullUrl = query ? `${targetUrl}?${query}` : targetUrl
  
  console.log(`Proxying ${method.toUpperCase()} ${fullUrl}`)
  
  try {
    // เตรียม request config สำหรับ axios
    const requestConfig = {
      url: fullUrl,
      method,
      headers,
      responseType: 'stream', // ใช้ stream เพื่อจัดการ response ได้ดีกว่า
    }
    
    // เพิ่ม body สำหรับ methods ที่ต้องการ
    if (!['get', 'head', 'delete'].includes(method)) {
      requestConfig.data = await c.req.arrayBuffer()
    }
    
    // ส่ง request ด้วย axios
    const response = await axiosInstance(requestConfig)
    
    const contentType = response.headers['content-type'] || ''
    
    // ถ้าเป็น HTML response ให้แทรก script
    if (contentType.includes('text/html')) {
      // แปลง stream เป็น text สำหรับ HTML
      const chunks = []
      for await (const chunk of response.data) {
        chunks.push(chunk)
      }
      let html = Buffer.concat(chunks).toString('utf-8')
      
      // สร้าง script tag
      const scriptTag = `<script type="text/javascript">\n${injectScript}\n</script>`
      
      // แทรก script ก่อน closing </head> tag หรือก่อน closing </body>
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${scriptTag}\n</head>`)
      } else if (html.includes('</body>')) {
        html = html.replace('</body>', `${scriptTag}\n</body>`)
      } else {
        // ถ้าไม่มี head หรือ body ให้เพิ่มที่ท้าย
        html += scriptTag
      }
      
      console.log('Script injected into HTML response')
      
      // สร้าง response ใหม่พร้อม modified HTML
      const responseHeaders = {}
      Object.keys(response.headers).forEach(key => {
        if (key.toLowerCase() !== 'content-length') {
          responseHeaders[key] = response.headers[key]
        }
      })
      
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      })
    } else {
      // ถ้าไม่ใช่ HTML ให้ส่งต่อ response ตามปกติ
      const responseHeaders = {}
      Object.keys(response.headers).forEach(key => {
        responseHeaders[key] = response.headers[key]
      })
      
      return new Response(response.data, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      })
    }
  } catch (error) {
    console.error('Proxy error:', error.message)
    return c.json({ 
      error: 'Proxy request failed', 
      message: error.message,
      url: fullUrl 
    }, 500)
  }
})

export default app
