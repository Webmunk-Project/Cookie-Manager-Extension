/* global registerCustomModule, registerMessageHandler */

(function () {
  let domainRules = []

  const fetchPublicDomain = function(hostname, rule) {
    if (rule.startsWith('!')) {
      return rule.substring(1)
    }

    const ruleTokens = rule.split('.')
    const hostnameTokens = hostname.split('.')

    let sliceStart = hostnameTokens.length - ruleTokens.length - 1

    if (ruleTokens[0] == '*') {
      sliceStart -= 1
    }

    const domainTokens = hostnameTokens.slice(sliceStart)

    return domainTokens.join('.')
  }

  const matches = function(hostname, rule) {
    if (rule.startsWith('*.')) {
      return hostname.endsWith(rule.substring(1))
    } else if (rule.startsWith('!')) {
      return rule === `!${hostname}`
    } else if (hostname.endsWith(`.${rule}`)){
      return true
    }

    return false
  }

  const fetchDomain = function (request, sender, sendResponse) {
    if (request.content === 'fetch_domain') {
      console.log(`[Domain Tools] Fetching domain for ${request.hostname}...`)

      let hostname = request.hostname.toLowerCase()
      let domain = hostname

      let ruleMatches = []

      if (domainRules.includes(hostname)) {
        return hostname
      }

      for (const rule of domainRules) {
        if (matches(hostname, rule)) {
          ruleMatches.push(rule)
        }
      }

      if (ruleMatches.length > 0) {
        ruleMatches.sort(function(one, two) {
          if (one[0] === '!' && two[0] !== '!') {
            return 1
          } else if (one[0] !== '!' && two[0] === '!') {
            return -1
          }

          const oneTokens = one.split('.').length
          const twoTokens = one.split('.').length
  
          if (oneTokens < twoTokens) {
            return -1
          } else if (oneTokens > twoTokens) {
            return 1
          }

          if (one.length < two.length) {
            return -1
          }
          else if (one.length > two.length) {
            return 1
          }

          return 0
        })

        const matchedRule = ruleMatches.pop()

        // console.log(`[Domain Tools] Found rule for ${request.hostname} -> ${matchedRule}`)

        domain = fetchPublicDomain(hostname, matchedRule)

        // console.log(`[Domain Tools] Domain for ${request.hostname} -> ${domain}`)
      }

      console.log(`[Domain Tools] Domain for ${request.hostname} -> ${domain}`)

      sendResponse({
        hostname: hostname,
        domain: domain,
        success: true
      })

      return true
    }

    return false
  }

  registerCustomModule(function (config) {
    fetch('../modules/domain-tools/js/domain-rules.json')
      .then(response => response.json())
      .then(function(data) {
        domainRules = data

        console.log(`[Domain Tools] Initialized (${domainRules.length} rules).`)

        registerMessageHandler('fetch_domain', fetchDomain)
      })
  })
})()
