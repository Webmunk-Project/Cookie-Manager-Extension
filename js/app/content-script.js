/* global MutationObserver, FileReader */

(function () {
  if (window.cookieManagerExtensionInitialized !== undefined) {
    return
  }

  window.cookieManagerExtensionInitialized = new Date().getTime()

  const cookieManagerModuleCallbacks = []

  window.registerModuleCallback = function (callback) {
    cookieManagerModuleCallbacks.push(callback)
  }

  const cookieManagerPageChangeListeners = []

  window.registerModulePageChangeListener = function (callback) {
    if (callback !== undefined) {
      cookieManagerPageChangeListeners.push(callback)
    }
  }

  window.cookieManagerPopulateContent = function (url, title, container, key, complete) {
    const blobToBase64 = blob => { // eslint-disable-line no-unused-vars
      const reader = new FileReader()

      reader.readAsDataURL(blob)

      return new Promise(resolve => {
        reader.onloadend = () => {
          resolve(reader.result)
        }
      })
    }

    const slugify = function (rawString) { // eslint-disable-line no-unused-vars
      return rawString
        .toString()
        .normalize('NFD') // split an accented letter in the base letter and the acent
        .replace(/[\u0300-\u036f]/g, '') // remove all previously split accents
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9 ]/g, '') // remove all chars not letters, numbers and spaces (to be replaced)
        .replace(/\s+/g, '-')
    }

    const imageRequest = new Request(url)

    let fileExtension = '.bin'

    fetch(imageRequest)
      .then((response) => {
        if (!response.ok) {
          console.log('[Cookie Manager] Unable to retrieve image URL: ' + url)

          complete()

          throw new Error(`HTTP error! Status: ${response.status}`)
        }

        return response.blob()
      })
      .then((responseBlob) => {
        fileExtension = responseBlob.type.split('/')[1]

        return responseBlob
      })
      .then(blobToBase64)
      .then((response) => {
        const filename = slugify(title) + '.' + fileExtension

        const fullResponse = response.replace(';base64', ';name=' + filename + ';base64')

        container[key] = fullResponse

        complete()
      })
  }

  if (['http:', 'https:'].includes(window.location.protocol)) {
    function locationFilterMatches (location, filters) { // eslint-disable-line no-unused-vars
      let hostMatch = false
      let pathMatch = true

      if (filters === undefined) {
        filters = []
      }

      for (const filter of filters) {
        for (const [operation, pattern] of Object.entries(filter)) {
          if (operation === 'hostSuffix') {
            if (window.location.hostname.endsWith(pattern)) {
              hostMatch = true
            }
          } else if (operation === 'hostEquals') {
            if (window.location.hostname.toLowerCase() === pattern.toLowerCase()) {
              hostMatch = true
            }
          } else if (operation === 'urlMatches') {
            const matchRe = new RegExp(pattern)

            if (window.location.href.toLowerCase().match(matchRe)) {
              hostMatch = true
            }
          }
        }
      }

      // Evaluate sites to exclude.

      for (const filter of filters) {
        for (const [operation, pattern] of Object.entries(filter)) {
          if (operation === 'excludeHostSuffix') {
            if (window.location.hostname.endsWith(pattern)) {
              hostMatch = false
            }
          } else if (operation === 'excludeHostEquals') {
            if (window.location.hostname.toLowerCase() === pattern.toLowerCase()) {
              hostMatch = false
            }
          } else if (operation === 'excludePaths') {
            for (const excludePath of pattern) {
              const pathRegEx = new RegExp(excludePath)

              if (pathRegEx.test(window.location.pathname)) {
                pathMatch = false
              }
            }
          }
        }
      }

      return hostMatch && pathMatch
    }

    console.log('[Cookie Manager] Loading content script (' + window.location.href + ')...'); // eslint-disable-line semi, no-trailing-spaces

    // LOAD CONTENT MODULES

    console.log('[Cookie Manager] ' + cookieManagerModuleCallbacks.length + ' extension(s) ready.')

    for (const callback of cookieManagerModuleCallbacks) {
      const config = {}

      callback(config)
    }

    const config = {
      subtree: true,
      childList: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true,
      characterDataOldValue: true
    }

    let pageUpdateScheduleId = -1
    let finalTimeout = null

    const changeFunction = function () {
      console.log('[Cookie Manager] Page update')

      for (const listener of cookieManagerPageChangeListeners) {
        listener()
      }
    }

    const listener = new MutationObserver(function (mutationsList) {
      let doUpdate = false

      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          doUpdate = true
        } else if (mutation.type === 'attributes') {
          doUpdate = true
        }
      }

      if (doUpdate) {
        let timeout = 2500

        const now = new Date().getTime()

        if (now - window.cookieManagerExtensionInitialized < 2500) {
          timeout = 500
        }

        if (pageUpdateScheduleId === -1) {
          pageUpdateScheduleId = window.setTimeout(function () {
            changeFunction()

            pageUpdateScheduleId = -1
          }, timeout)
        }

        if (finalTimeout !== null) {
          window.clearTimeout(finalTimeout)
        }

        finalTimeout = window.setTimeout(changeFunction, 2500)
      }
    })

    listener.observe(document, config)
  }
})(); // eslint-disable-line semi, no-trailing-spaces
