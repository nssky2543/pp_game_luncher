import { resolve } from 'path'
import { rmSync, existsSync } from 'fs'
import { Hono } from 'hono'
import { log } from 'console'

export const DownloadController = (domain: string) => {
  const app = new Hono()

  app.get('/*', async (c, next) => {
    const url = new URL(c.req.url)
    const targetUrl = `${domain}${url.pathname}${url.search}`
    // check if path includes /gs2c/reloadBalance.do use await next()
    if (url.pathname.includes('reloadBalance.do')) {
      return await next()
    }
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
    return fetch(targetUrl, requestOptions).then(async res => {
      const data: any = res

      if (data.status == 200) {
        // check content-type
        const contentType = data.headers.get('content-type')
        if (contentType?.includes('text/html')) {
          const gameDir = resolve(process.cwd(), `public/games/${url.pathname}index.html`)
          await Bun.write(gameDir, await data.blob())
          console.log('success html fetch: ', data.url)
          return new Response(Bun.file(gameDir), {
            headers: {
              'Content-Type': 'text/html'
            }
          })
        }
        const gameDir = resolve(process.cwd(), `public/games/${url.pathname}`)
        await Bun.write(gameDir, await data.blob())
        console.log('success fetch: ', data.url)
        return new Response(Bun.file(gameDir))
      } else {
        console.log('error fetch: ', data.url)
        return new Response(await data.blob(), {
          status: data.status,
          headers: data.headers
        })
      }
    })
  })

  return app
}
