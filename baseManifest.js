module.exports = {
  "name": "Cookie Manager", 
  "short_name": "Cookie Manager", 
  "icons": {
      "256": "images/icon-256.png", 
      "128": "images/icon-128.png", 
      "48": "images/icon-48.png",
      "32": "images/icon-32.png", 
      "16": "images/icon-16.png"
  }, 
  "description": "Research extension to support browser cookie behavior.", 
  "background": {
    "service_worker": "background.bundle.js"
  }, 
  "version": "0.15", 
  "manifest_version": 3, 
  "action": {
    "default_icon": {
      "256": "images/icon-256.png", 
      "128": "images/icon-128.png", 
      "48": "images/icon-48.png",
      "32": "images/icon-32.png", 
      "16": "images/icon-16.png"
	}    
  }, 
  "permissions": [
  	"scripting",
    "storage", 
    "alarms",
    "tabs"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "modules": [
  	"modules/ad-scraper",
  	"modules/search-mirror",
  	"modules/cookie-ui",
  	"modules/cookies"
  ]
}
