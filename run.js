#!/usr/bin/env node
require('dotenv').config()
const program = require('commander')
const fetch = require('node-fetch')
const urlJoin = require('url-join')

console.log(process.argv)

program
  .option('--backend <backend>',
    [
      'where app version manager server run',
      'for example \'http://<host>:<port>/apk-api/\'',
      'default to: ' + process.env.REMOTE_PREFIX
    ].join(', '))

program
  .command('new <domain> <version> <url> [brief]')
  .description('create a new version')
  .action(function (domain, version, url, brief) {
    let backend = program.backend || process.env.REMOTE_PREFIX
    if (!(url && version && domain)) {
      this.help()
    }
    let targetUrl = urlJoin(
      backend, '/' + domain + '/' + version
    )
    console.log('post to: ' + targetUrl)
    ;(async function () {
      let rsp = await fetch(targetUrl, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url, brief
        })
      })
      if (!rsp.ok) {
        throw new Error(await rsp.text())
      }
    })()
      .then(function () {
        console.log('success')
      })
      .catch(function (err) {
        console.log(err.message)
        process.exit(1)
      })
  })

program
  .command('remove')
  .description('remove a version')

program
  .command('update <domain> <verson> <url> [brief]')
  .description('update a version')
  .action(function (domain, version, url, brief) {
    let backend = program.backend || process.env.REMOTE_PREFIX
    if (!(url && version && domain)) {
      this.help()
    }
    let targetUrl = urlJoin(
      backend, '/' + domain + '/' + version
    )
    console.log('put to: ' + targetUrl)
    ;(async function () {
      let rsp = await fetch(targetUrl, {
        method: 'put',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url, brief
        })
      })
      if (!rsp.ok) {
        throw new Error(await rsp.text())
      }
    })()
      .then(() => {
        console.log('success')
      })
      .catch((err) => {
        console.log(err.message)
        process.exit(0)
      })
  })

program.parse(process.argv)

if (!program.args.length) {
  console.error([
    'You did not pass any commands',
    'run \'run.js --help\' to see a list of all available commands'
  ].join(', '))
  process.exit(1)
}
