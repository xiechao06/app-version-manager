require('dotenv').config()
const mount = require('koa-mount')
const Koa = require('koa')
const router = new (require('koa-router'))()
const fs = require('fs-extra')
const R = require('ramda')
const semver = require('semver')

const app = new Koa()

let { CONFIG_FILE } = process.env

let config

const compareVersion = (a, b) => {
  if (a === b) {
    return 0
  }
  if (semver.lt(a, b)) {
    return 1
  }
  return -1
}

router.get('/versions', async ctx => {
  let { domain } = ctx.request.query
  if (!domain) {
    ctx.throw(403, 'parameter domain unspecified')
  }
  if (!config.hasOwnProperty(domain)) {
    ctx.throw(403, 'no such domain')
  }
  ctx.body = R.keys(config[domain]).sort(compareVersion)
})

router.get('/:domain/:version', async ctx => {
  let { domain, version } = ctx.params
  if (!domain) {
    ctx.throw(403, 'parameter domain unspecified')
  }
  if (!version) {
    ctx.throw(403, 'parameter version unspecified')
  }
  if (version === 'latest') {
    version = R.keys(R.propOr({}, domain, config)).sort(compareVersion)[0]
  }
  if (!version) {
    ctx.throw(403, 'no such apk')
  }
  ctx.body = R.pathOr(null, [domain, version])(config) || ctx.throw(403, 'no such apk')
})

router.post('/:domain/:version', async ctx => {
  let { domain, version } = ctx.params
  let { url } = ctx.request.body

  if (!url) {
    ctx.throw(403, 'parameter url unspecified')
  }
  if (!version) {
    ctx.throw(403, 'parameter version unspecified')
  }
  if (!domain) {
    ctx.throw(403, 'parameter domain unspecified')
  }

  if (!config.hasOwnProperty(domain)) {
    config[domain] = {}
  }
  if (config[domain].hasOwnProperty(version)) {
    ctx.throw('403', `apk(domain: ${domain}, version: ${version}) exists`)
  }
  config[domain][version] = ctx.request.body
  if (process.env.DEBUG) {
    console.log('update config: ', JSON.stringify(config, null, 4))
  }
  await fs.writeJSON(CONFIG_FILE, config, {
    spaces: 4
  })
  ctx.body = {}
})

router.put('/:domain/:version', async ctx => {
  let { version, domain } = ctx.params

  if (!version) {
    ctx.throw(403, 'parameter version unspecified')
  }
  if (!domain) {
    ctx.throw(403, 'parameter domain unspecified')
  }
  if (!ctx.request.body || R.isEmpty(ctx.request.body)) {
    ctx.throw(403, 'nothing to update')
  }
  if (!R.path([domain, version], config)) {
    ctx.throw('403', `no such apk(domain: ${domain}, version: ${version})`)
  }
  config[domain][version] = ctx.request.body
  if (process.env.DEBUG) {
    console.log('update config: ', JSON.stringify(config, null, 4))
  }
  await fs.writeJSON(CONFIG_FILE, config, {
    spaces: 4
  })
  ctx.body = {}
})

app
  .use(require('koa-logger')())
  .use(require('koa-bodyparser')())
  .use(require('koa-json-error')())
  .use(router.routes())
  .use(router.allowedMethods())

;(async function () {
  try {
    await fs.access(CONFIG_FILE, fs.constants.W_OK | fs.constants.R_OK)
  } catch (err) {
    await fs.writeJSON(CONFIG_FILE, {})
  }
  config = await fs.readJSON(CONFIG_FILE)
  if (process.env.DEBUG) {
    console.log('start with configuration: ', JSON.stringify(config, null, 2))
  }
  ;(function () {
    if (process.env.PREFIX) {
      return new Koa().use(mount(process.env.PREFIX, app))
    }
    return app
  })().listen(process.env.PORT)
})()
  .catch(function (err) {
    console.log(err)
  })
