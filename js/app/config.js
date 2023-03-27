const configFunction = function () {
  return {
    primaryColor: '#616161',
    accentColor: '#616161',
    extensionName: 'Cookie Manager',
    generator: 'cookie-manager',
    aboutExtension: 'Unified cookie interface for research.',
    enrollUrl: 'https://cookie-enroll.webmunk.org/enroll/enroll.json'
  }
}

if (typeof define === 'undefined') {
  config = configFunction() // eslint-disable-line no-global-assign, no-undef
} else {
  define([], configFunction)
}
