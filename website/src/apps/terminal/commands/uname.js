import { getEnvInfo } from '../../env.ts'

export const description = 'Print kernel / environment information'

export default function uname(args, _term) {
  const env = getEnvInfo()
  const flag = args[0] || '-s'

  // Match the subset of GNU coreutils `uname` flags that make sense for a
  // browser-derived identity — everything is pulled from navigator + Intl.
  const kernelName = 'WebUA'
  const nodeName =
    (typeof location !== 'undefined' && location.hostname) || 'pai'
  const kernelRel = `${env.browser.toLowerCase().replace(/\s+/g, '-')}`
  const kernelVer = env.browserVersion || '0'
  const machine = env.arch
  const os = env.osName.toLowerCase()

  const parts = {
    '-s': kernelName,
    '-n': nodeName,
    '-r': kernelRel,
    '-v': kernelVer,
    '-m': machine,
    '-o': os,
  }

  if (flag === '-a') {
    return [kernelName, nodeName, kernelRel, kernelVer, machine, os].join(' ')
  }
  if (parts[flag] !== undefined) return parts[flag]
  return `uname: unrecognised option '${flag}'\nUsage: uname [-a|-s|-n|-r|-v|-m|-o]`
}
