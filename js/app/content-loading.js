/* global MutationObserver, chrome, crypto */

if (window.cookieManagerPreloaded === undefined) {
  const body = document.querySelector('html')
  
  body.style.opacity = 0.0
  
  if (true) {
    if (window.location === window.parent.location) {
      console.log('[Uniform Cookie UI Preload] Fetching configuration...')

      chrome.runtime.sendMessage({
        content: 'fetch_configuration'
      }, function (config) {
        const cookieConfig = config['cookie-ui']

        console.log('[Uniform Cookie UI Preload] Got configuration.')

        console.log(`[Uniform Cookie UI Preload] Fetching domain for ${window.location.hostname}...`)

        if (cookieConfig['always-display-ui'] === true && cookieConfig['always-display-ui-interval'] !== undefined) {
          chrome.runtime.sendMessage({
            content: 'fetch_domain',
            hostname: window.location.hostname
          }, function (message) {
            console.log(`[Uniform Cookie UI Preload] Fetched domain: ${message.domain}.`)

            domainKey = message.domain.replaceAll('.', '-')
      
            lastVisitLookupKey = `cookie-ui-consent-shown-${domainKey}`

            const lastShownKey = 'always-display-ui-interval-last-shown'

            let alwaysDisplayInterval = cookieConfig['always-display-ui-interval']

            if (alwaysDisplayInterval === undefined || alwaysDisplayInterval === null) {
              alwaysDisplayInterval = 0
            }

            if (alwaysDisplayInterval > 0) {
              chrome.storage.local.get(lastVisitLookupKey).then((result) => {
                if (result[lastVisitLookupKey] !== undefined) {
                  console.log('[Uniform Cookie UI Preload] Pop-up display overriden, but dialog shown before. Skipping universal cookie UI...')
    
                  body.style.opacity = 1.0
                } else {
                  chrome.storage.local.get(lastShownKey).then((result) => {
                    let lastShown = 0
    
                    if (result[lastShownKey] !== undefined) {
                        lastShown = result[lastShownKey]
                    }
    
                    const now = Date.now()
    
                    let elapsed = (now - lastShown) / 1000
    
                    if (elapsed < alwaysDisplayInterval) {
                      console.log('[Uniform Cookie UI Preload] Not yet time for pop-up, imediately showing page...')

                      body.style.opacity = 1.0
                    }
                  })
                }
              })
            }
          })
        }
      })
    }
  }
}
  