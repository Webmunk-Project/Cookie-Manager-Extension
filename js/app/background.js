import {config, setConfig} from "./config"
import pdk from "../lib/passive-data-kit"

self.PDK = pdk;

/* global chrome, fetch */

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

const loadRules = function (tabId) {
  chrome.storage.local.get({ 'cookie-manager-config': null }, function (result) {
    setConfig(result['cookie-manager-config']);
    if (config !== null && config !== undefined) {
      chrome.scripting.executeScript({
        target: {
          tabId: tabId, // eslint-disable-line object-shorthand
          allFrames: true
        },
        files: ['/vendor/js/jquery.js', 'contentScript.bundle.js']
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
  chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
    const identifier = result['pdk-identifier']

    if (identifier !== undefined && identifier !== '') {
      chrome.storage.local.get({ 'cookie-manager-config': null }, function (result) {
        console.log("config = ",config)
        setConfig(result['cookie-manager-config']);

        if (config['enroll-url'] === undefined) {
          config['enroll-url'] = 'https://cookie-enroll.webmunk.org/enroll/enroll.json'
        }

        const endpoint = config['enroll-url'] + '?identifier=' + identifier

        fetch(endpoint, {
          redirect: 'follow' // manual, *follow, error
        })
          .then(response => response.json())
          .then(function (data) {
            if (data.rules !== undefined) {
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

/*
function digestMessage (str) {
  // Via https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript

  let hash = 0
  for (let i = 0, len = str.length; i < len; i++) {
    const chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}
*/

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
    chrome.storage.local.get({ 'cookie-manager-config': null }, (result) => {
      setConfig(result['cookie-manager-config']);
      sendResponse(config)
    })

    return true
  } else if (request.content === 'nudge_data_points') {
    self.PDK.enqueueDataPoint(null, null, function () {
      sendResponse({
        message: 'Data points nudged successfully.',
        success: true
      })
    })
  } else if (request.content === 'record_data_point') {
    request.payload['tab-id'] = sender.tab.id

    if (filterDataPointRequest(request)) {
      // Skip
    } else {
      console.log('[Cookie Manager] Recording ' + request.generator + ' data point...')

      self.PDK.enqueueDataPoint(request.generator, request.payload, function () {
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

    if (identifier !== undefined) {
      chrome.storage.local.set({
        'pdk-identifier': identifier
      }, function (result) {
        refreshConfiguration(sendResponse)
      })
    } else {
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
    console.log("config = ",config)
    setConfig(result['cookie-manager-config']);
    console.log('[Cookie Manager] Uploading queued data points...')

    self.PDK.persistDataPoints(function () {
      console.log('[Cookie Manager] Begin upload: ' + (new Date()) + ' -- ' + Date.now())
      self.PDK.uploadQueuedDataPoints(config['upload-url'], config.key, null, function () {
        chrome.storage.local.set({
          'pdk-last-upload': (new Date().getTime())
        }, function (result) {
          console.log('[Cookie Manager] End upload: ' + (new Date()) + ' -- ' + Date.now())
        })
      })
    })
  })

  refreshConfiguration(function (response) {})
}

chrome.alarms.onAlarm.addListener(uploadAndRefresh)

const webmunkModules = []

self.registerCustomModule = function (callback) { // eslint-disable-line no-unused-vars
  webmunkModules.push(callback)
}

self.registerMessageHandler = function (name, handlerFunction) { // eslint-disable-line no-unused-vars
  handlerFunctions[name] = handlerFunction
}

refreshConfiguration(function (response) {
  console.log('[Cookie Manager] Initialized.')

  for (let i = 0; i < webmunkModules.length; i++) {
    webmunkModules[i](response)
  }

  uploadAndRefresh('pdk-upload')
})
