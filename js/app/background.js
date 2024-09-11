/* global chrome, fetch, nacl */

function openWindow () {
  const optionsUrl = chrome.runtime.getURL('index.html')

  chrome.tabs.query({}, function (extensionTabs) {
    for (let i = 0; i < extensionTabs.length; i++) {
      if (optionsUrl === extensionTabs[i].url) {
        chrome.windows.remove(extensionTabs[i].windowId)
      }
    }

    chrome.windows.create({
      height: 480,
      width: 640,
      type: 'panel',
      url: chrome.runtime.getURL('index.html')
    })
  })
}

chrome.action.onClicked.addListener(function (tab) {
  openWindow()
})

let config = null

const loadRules = function (tabId) {
  chrome.storage.local.get({ 'cookie-manager-config': null }, function (result) {
    config = result['cookie-manager-config']

    if (config !== null && config !== undefined) {
      chrome.scripting.executeScript({
        target: {
          tabId: tabId, // eslint-disable-line object-shorthand
          allFrames: true
        },
        files: ['/vendor/js/jquery.js', '/js/app/content-script.js']
      }, function (result) {
        // Script loaded
      })
    }
  })
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (tab.url.startsWith('https://') || tab.url.startsWith('http://')) {
    loadRules(tabId)
  }
})

function refreshConfiguration (sendResponse) {
  console.log(`[Cookie Manager] refreshConfiguration called...`)

  chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
    const identifier = result['pdk-identifier']

    console.log(`[Cookie Manager] Identifier: ${identifier}`)

    if (identifier !== undefined && identifier !== '') {
      chrome.storage.local.get({ 'cookie-manager-config': null }, function (result) {
        config = result['cookie-manager-config']

        if (config['enroll-url'] === undefined) {
          config['enroll-url'] = 'https://cookie-enroll.webmunk.org/enroll/enroll.json'
        }

        const endpoint = config['enroll-url'] + '?identifier=' + identifier

        console.log(`[Cookie Manager] Configuration fetch: ${endpoint}`)

        fetch(endpoint, {
          redirect: 'follow' // manual, *follow, error
        })
          .then(response => response.json())
          .then(function (data) {
            // console.log('[Cookie Manager] Got config response...')
            // console.log(data)

            if (data.rules !== undefined) {
              console.log('[Cookie Manager] Configuration refreshed...')

              chrome.storage.local.set({
                'cookie-manager-config': data.rules
              }, function (result) {
                if (data.rules.tasks !== undefined && data.rules.tasks.length > 0) {
                  chrome.action.setBadgeBackgroundColor(
                    { color: '#008000' }, // Green
                    function () {
                      chrome.action.setBadgeText(
                        {
                          text: '' + data.rules.tasks.length
                        }, // Green
                        function () { /* ... */

                        })
                    })

                  chrome.storage.local.get(['CookieManagerLastNotificationTime'], function (result) {
                    let lastNotification = result.CookieManagerLastNotificationTime

                    if (lastNotification === undefined) {
                      lastNotification = 0
                    }

                    const now = new Date().getTime()

                    if (now - lastNotification > (8 * 60 * 60 * 1000)) {
                      openWindow()

                      chrome.storage.local.set({
                        CookieManagerLastNotificationTime: now
                      }, function (result) {

                      })
                    }
                  })
                } else {
                  chrome.action.setBadgeBackgroundColor(
                    { color: [0, 0, 0, 255] }, // Green
                    function () {
                      chrome.action.setBadgeText(
                        {
                          text: ''
                        }, // Green
                        function () { /* ... */

                        })
                    })
                }

                sendResponse(data.rules)
              })
            } else {
              sendResponse(null)
            }
          })
          .catch((error) => {
            console.error('Error:', error)
          })
      })
    } else {
      sendResponse(null)
    }
  })
}

const tabStates = {}

function generateSecureHash (originalString) { // eslint-disable-line no-unused-vars
  const messageUint8 = nacl.util.decodeUTF8(originalString)

  const fullMessage = nacl.hash(messageUint8)

  return Array.prototype.map.call(fullMessage, function (byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2)
  }).join('')
}

function filterDataPointRequest (dataPoint) {
  const tabId = dataPoint['tab-id']

  if (tabStates[tabId] === undefined) {
    tabStates[tabId] = {}
  }

  /*
        if (dataPoint.generator == 'webmunk-extension-matched-rule') {
            if (tabStates[tabId]['webmunk-extension-matched-rule'] === undefined) {
                tabStates[tabId]['webmunk-extension-matched-rule'] = {}
            }

            const matchStates = tabStates[tabId]['webmunk-extension-matched-rule']

            if (matchStates[dataPoint.payload.rule] !== dataPoint.payload.count) {
                matchStates[dataPoint.payload.rule] = dataPoint.payload.count

                return false
            }

            return true
        } else if (dataPoint.generator == 'webmunk-extension-class-added') {
            if (tabStates[tabId][''] === undefined) {
                tabStates[tabId]['webmunk-extension-class-added'] = {}
            }

            const classesAdded = tabStates[tabId]['webmunk-extension-class-added']

            const elementHash = digestMessage(dataPoint.payload['element-content*'] + dataPoint.payload['class-name'])

            if (classesAdded[elementHash] === undefined) {
                classesAdded[elementHash] = true

                return false
            }

            return true
        } else if (dataPoint.generator == 'webmunk-extension-element-show' || dataPoint.generator == 'webmunk-extension-element-hide') {
            if (tabStates[tabId][''] === undefined) {
                tabStates[tabId]['webmunk-extension-element-visible'] = {}
            }

            const visibleState = tabStates[tabId]['webmunk-extension-element-visible']

            const elementId = dataPoint.payload['element-id']

            let visible = true

            if (dataPoint.generator == 'webmunk-extension-element-hide') {
                visible = false
            }

            if (visibleState[elementId] !== visible) {
                visibleState[elementId] = visible

                return false
            }

            return true
        }
    */

  return false
}

const handlerFunctions = {}

function handleMessage (request, sender, sendResponse) {
  if (request.content === 'fetch_configuration') {
    chrome.storage.local.get({ 'cookie-manager-config': null }, function (result) {
      config = result['cookie-manager-config']

      sendResponse(config)
    })

    return true
  } else if (request.content === 'nudge_data_points') {
    window.PDK.enqueueDataPoint(null, null, function () {
      sendResponse({
        message: 'Data points nudged successfully.',
        success: true
      })
    })
  } else if (request.content === 'record_data_point') {
    if (sender !== null && sender !== undefined && sender.tab !== undefined && sender.tab.id !== undefined) {
      request.payload['tab-id'] = sender.tab.id
    }

    if (filterDataPointRequest(request)) {
      // Skip
    } else {
      // console.log('[Cookie Manager] Recording ' + request.generator + ' data point...')

      window.PDK.enqueueDataPoint(request.generator, request.payload, function () {
        console.log('[Cookie Manager] Recorded ' + request.generator + ' data point...')

        sendResponse({
          message: 'Data point enqueued successfully: ' + request.generator,
          success: true
        })
      })
    }

    return true
  } else if (request.content === 'refresh_configuration') {
    const identifier = request.payload.identifier

    // console.log(`[Cookie Manager] Config refresh request for ${identifier}:`)
    // console.log(request)

    if (identifier !== undefined) {
      chrome.storage.local.set({
        'pdk-identifier': identifier
      }, function (result) {
        console.log(`[Cookie Manager] refreshConfiguration[1]`)

        refreshConfiguration(sendResponse)
      })
    } else {
      console.log(`[Cookie Manager] refreshConfiguration[2]`)

      refreshConfiguration(sendResponse)
    }

    return true
  } else {
    const handlerFunction = handlerFunctions[request.content]

    if (handlerFunction !== undefined) {
      console.log('[Cookie Manager] Fetching handler for ' + request.content + '...')

      return handlerFunction(request, sender, sendResponse)
    }
  }

  return false
}

chrome.runtime.onMessage.addListener(handleMessage)

chrome.storage.local.get(['PDKExtensionInstallTime'], function (result) {
  if (result.PDKExtensionInstallTime === undefined) {
    openWindow()

    const now = new Date().getTime()

    chrome.storage.local.set({
      PDKExtensionInstallTime: now
    }, function (result) {

    })
  }
})

chrome.alarms.create('pdk-upload', { periodInMinutes: 5 })

const uploadAndRefresh = function (alarm) {
  console.log('[Cookie Manager] Uploading data and refreshing configuration...')

  chrome.storage.local.get({ 'cookie-manager-config': null }, function (result) {
    config = result['cookie-manager-config']

    handleMessage({
      content: 'fetch_browser_history'
    }, null, function (results) {
      for (const result of results) {
        result.date = result.visit.visitTime
        
        if (result.url !== null && result.url !== undefined && result.url.startsWith('chrome-extension://') === false) {
          handleMessage({
            content: 'record_data_point',
            generator: 'browser-history-visit',
            payload: result // eslint-disable-line object-shorthand
          }, null, function (results) {
    
          })
        }
      }

      console.log('[Cookie Manager] Uploading queued data points...')

      window.PDK.persistDataPoints(function () {
        console.log('[Cookie Manager] Begin upload: ' + (new Date()) + ' -- ' + Date.now())
        window.PDK.uploadQueuedDataPoints(config['upload-url'], config.key, null, function () {
          chrome.storage.local.set({
            'pdk-last-upload': (new Date().getTime())
          }, function (result) {
            console.log('[Cookie Manager] End upload: ' + (new Date()) + ' -- ' + Date.now())
          })
        })
      })
    })
  })

  refreshConfiguration(function (response) {})
}

chrome.alarms.onAlarm.addListener(uploadAndRefresh)

const webmunkModules = []

const registerCustomModule = function (callback) { // eslint-disable-line no-unused-vars
  webmunkModules.push(callback)
}

const registerMessageHandler = function (name, handlerFunction) { // eslint-disable-line no-unused-vars
  handlerFunctions[name] = handlerFunction
}

const loadConfiguration = function() {
  refreshConfiguration(function (response) {
    console.log('[Cookie Manager] Initialized.')
  
    if (response !== null) {
      for (let i = 0; i < webmunkModules.length; i++) {
        webmunkModules[i](response)
      }
  
      uploadAndRefresh('pdk-upload')
    } else {
      chrome.storage.local.onChanged.addListener(function(changes, areaName) {
        if (changes['pdk-identifier'] !== undefined) {
          chrome.storage.local.onChanged.removeListener(this)

          loadConfiguration()
        }
      })
    }
  })
}

loadConfiguration()



