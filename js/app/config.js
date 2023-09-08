const config = {
  primaryColor: '#616161',
  accentColor: '#616161',
  extensionName: 'Cookie Manager',
  generator: 'cookie-manager',
  aboutExtension: 'Unified cookie interface for research.',
  enrollUrl: 'https://cookie-enroll.webmunk.org/enroll/enroll.json'
}

function setConfig (source) {
  for (const p in source) {
    config[p] = source[p]
  }
}

export { config, setConfig }
