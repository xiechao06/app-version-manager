#!/usr/bin/env node
const sh = require('shelljs')
const minimist = require('minimist')
const fs = require('fs-extra')

const USAGE = `
  Usage: upload.js <options>

  upload new app versions

  Options:

    -h, --help        output usage information
    -c                version info, a json file contains a list of {domain, version, url, brief}
    --replace         replace the old version, default to false
`

const args = minimist(process.argv.slice(2), {
  alias: { h: 'help' }
})

if (args.h) {
  console.log(USAGE)
  process.exit(0)
}

if (!args.c) {
  console.log(USAGE)
  process.exit(-1)
}

(async function () {
  for (let { domain, version, url, brief } of await fs.readJSON(args.c)) {
    let { code } = sh.exec(`node run.js ${args.replace ? 'update' : 'new'} ${domain} ${version} ${url} ${brief || ''}`)
    if (code !== 0) {
      process.exit(1)
    }
  }
})()
  .catch(function (err) {
    console.log(err.message)
  })
