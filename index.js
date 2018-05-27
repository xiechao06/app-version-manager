require('dotenv').config()
const mount = require('koa-mount')
const Koa = require('koa')
const router = new (require('koa-router'))()
const fs = require('fs-extra')
const R = require('ramda')
const semver = require('semver')
const { ERROR_CODES } = require('./constant')

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

router.get('/', async ctx => {
  let { domain, version } = ctx.request.query

  if (!domain) {
    ctx.throw(403, 'parameter domain not specified')
  }
  if (!version) {
    version = 'latest'
  }

  ctx.body = {
    data: [].concat(domain).map(domain => {
      if (!config.hasOwnProperty(domain)) {
        return {
          domain, apks: null
        }
      }
      let apks = [].concat(version).map(version => {
        if (version === 'latest') {
          return R.sort(
            (a, b) => compareVersion(a.version, b.version),
            config[domain]
          )[0]
        }
        return R.find(it => it.version === version, config[domain]) || null
      })
      return {
        domain,
        apks
      }
    })
  }
})

router.get('/versions', async ctx => {
  let { domain } = ctx.request.query
  if (!domain) {
    ctx.throw(403, 'parameter domain unspecified')
  }
  ctx.body = {
    data: [].concat(domain).map(domain => ({
      domain,
      versions: config.hasOwnProperty(domain)
        ? config[domain].map(it => it.version).sort(compareVersion)
        : null
    }))
  }
})

router.get('/:domain/:version', async ctx => {
  let { domain, version } = ctx.params
  if (!domain) {
    ctx.throw(403, 'parameter domain unspecified', {
      code: ERROR_CODES.INVALID_ARGUMENTS
    })
  }
  if (!version) {
    ctx.throw(403, 'parameter version unspecified', {
      code: ERROR_CODES.INVALID_ARGUMENTS
    })
  }

  if (!config.hasOwnProperty(domain)) {
    ctx.throw(403, 'no such domain for apk', {
      code: ERROR_CODES.NOT_FOUND
    })
  }

  if (version === 'latest') {
    ctx.body = R.sort((a, b) => compareVersion(a.version, b.version),
      config[domain])[0] || ctx.throw(403, 'no such version', {
        code: ERROR_CODES.NOT_FOUND
      })
    return
  }
  ctx.body = R.find(it => it.version === version, config[domain]) ||
    ctx.throw(403, 'no such version', {
      code: ERROR_CODES.UNKNOWN_VERSION
    })
})

router.post('/:domain/:version', async ctx => {
  let { domain, version } = ctx.params
  let { url } = ctx.request.body

  if (!url) {
    ctx.throw(403, 'parameter url unspecified', {
      code: ERROR_CODES.INVALID_ARGUMENTS
    })
  }
  if (!version) {
    ctx.throw(403, 'parameter version unspecified', {
      code: ERROR_CODES.INVALID_ARGUMENTS
    })
  }
  if (!domain) {
    ctx.throw(403, 'parameter domain unspecified', {
      code: ERROR_CODES.INVALID_ARGUMENTS
    })
  }

  if (!config.hasOwnProperty(domain)) {
    config[domain] = []
  }
  if (~config[domain].map(it => it.version).indexOf(version)) {
    ctx.throw(403, `apk(domain: ${domain}, version: ${version}) exists`, {
      code: ERROR_CODES.VERSION_EXISTS
    })
  }
  // it just push, so versions is not stored descendentally
  config[domain].push(Object.assign({ version }, ctx.request.body))
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
