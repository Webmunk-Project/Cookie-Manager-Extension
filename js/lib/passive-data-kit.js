/* global chrome, indexedDB, fetch, nacl, CompressionStream */

const pdkFunction = function () {
  const pdk = {}

  const blobToB64 = function (data) {
    return btoa(new Uint8Array(data).reduce((data, byte) =>
      data + String.fromCharCode(byte),
    ''))
  }

  pdk.queuedPoints = []
  pdk.lastPersisted = 0

  pdk.openDatabase = function (success, failure) {
    if (pdk.db !== undefined) {
      success(pdk.db)

      return
    }

    const PDK_DATABASE_VERSION = 1

    const request = indexedDB.open('passive_data_kit', PDK_DATABASE_VERSION)

    request.onerror = function (event) {
      failure(event)
    }

    request.onsuccess = function (event) {
      pdk.db = request.result

      success(pdk.db)
    }

    request.onupgradeneeded = function (event) {
      pdk.db = event.target.result

      switch (event.oldVersion) {
        case 0: {
          const dataPoints = pdk.db.createObjectStore('dataPoints', {
            keyPath: 'dataPointId',
            autoIncrement: true
          })

          dataPoints.createIndex('generatorId', 'generatorId', { unique: false })
          dataPoints.createIndex('dataPoint', 'dataPoint', { unique: false })
          dataPoints.createIndex('date', 'date', { unique: false })
          dataPoints.createIndex('transmitted', 'transmitted', { unique: false })
        }
      }
    }
  }

  pdk.persistDataPoints = function (complete) {
    pdk.lastPersisted = Date.now()

    const pendingPoints = pdk.queuedPoints

    pdk.queuedPoints = []

    pdk.openDatabase(function (db) {
      const objectStore = db.transaction(['dataPoints'], 'readwrite').objectStore('dataPoints')

      pendingPoints.forEach(function (point) {
        const request = objectStore.add(point)

        request.onsuccess = function (event) {
          // console.log('[PDK] Data point saved successfully: ' + generatorId + '.')
        }

        request.onerror = function (event) {
          console.log('[PDK] Data point enqueuing failed: ' + point.generatorId + '.')
          console.log(event)
        }
      })

      console.log('[PDK] Data points saved successfully: ' + pendingPoints.length + '.')

      complete()
    }, function (error) {
      if (error) {
        console.log(error)
      }
    })
  }

  pdk.enqueueDataPoint = function (generatorId, dataPoint, complete) {
    if (generatorId === null || dataPoint === null) { // eslint-disable-line no-empty

    } else {
      const payload = {
        generatorId: generatorId, // eslint-disable-line object-shorthand
        dataPoint: dataPoint, // eslint-disable-line object-shorthand
        transmitted: 0
      }

      if (dataPoint.date !== undefined) {
        payload.date = dataPoint.date
      } else {
        payload.date = Date.now()
      }

      pdk.queuedPoints.push(payload)
    }

    if (pdk.queuedPoints.length > 0 && (Date.now() - pdk.lastPersisted) > 1000) {
      pdk.persistDataPoints(complete)
    } else {
      complete()
    }
  }

  pdk.currentlyUploading = false

  pdk.uploadProgressCallback = null
  pdk.uploadCompleteCallback = null

  pdk.uploadQueuedDataPoints = function (endpoint, serverKey, progressCallback, completeCallback) {
    if (progressCallback !== null && pdk.uploadProgressCallback === null) {
      pdk.uploadProgressCallback = progressCallback
    }

    if (completeCallback !== null && pdk.uploadCompleteCallback === null) {
      pdk.uploadCompleteCallback = completeCallback
    }

    if (pdk.currentlyUploading) {
      return
    }

    pdk.currentlyUploading = true

    pdk.openDatabase(function (db) {
      const index = db.transaction(['dataPoints'], 'readonly')
        .objectStore('dataPoints')
        .index('transmitted')
        
      const countRequest = index.count(0)
      
      countRequest.onsuccess = function () {
		  console.log('[PDK] Remaining data points: ' + countRequest.result)

		  const request = index.getAll(0, 64)

		  request.onsuccess = function () {
			const pendingItems = request.result

			if (pendingItems.length === 0) {
			  if (pdk.uploadCompleteCallback !== null) {
				pdk.uploadCompleteCallback() // Finished
			  }

			  pdk.currentlyUploading = false

			  pdk.uploadCompleteCallback = null
			  pdk.uploadProgressCallback = null
			} else {
			  const toTransmit = []
			  const xmitBundle = []

			  const pendingRemaining = pendingItems.length

			  console.log('[PDK] Remaining data points (this bundle): ' + pendingRemaining)

			  if (pdk.uploadProgressCallback !== undefined && pdk.uploadProgressCallback !== null) {
				  pdk.uploadProgressCallback(pendingRemaining)
			  }

			  let bundleLength = 0

			  for (let i = 0; i < pendingRemaining && bundleLength < (128 * 1024); i++) {
          const pendingItem = pendingItems[i]

          pendingItem.transmitted = new Date().getTime()

          pendingItem.dataPoint.date = pendingItem.date
          pendingItem.dataPoint.generatorId = pendingItem.generatorId

          toTransmit.push(pendingItem)
          xmitBundle.push(pendingItem.dataPoint)

          const bundleString = JSON.stringify(pendingItem.dataPoint)

          bundleLength += bundleString.length
			  }

			  const status = {
          pending_points: pendingRemaining,
          generatorId: 'pdk-system-status'
			  }

			  chrome.system.cpu.getInfo(function (cpuInfo) {
				status['cpu-info'] = cpuInfo

				chrome.system.display.getInfo(function (displayUnitInfo) {
				  status['display-info'] = displayUnitInfo

				  chrome.system.memory.getInfo(function (memoryInfo) {
					status['memory-info'] = memoryInfo

					if (chrome.system.storage !== undefined) {
					  chrome.system.storage.getInfo(function (storageUnitInfo) {
						status['storage-info'] = storageUnitInfo

						xmitBundle.push(status)

						console.log('[PDK] Created bundle of size ' + bundleLength + '.')

						if (toTransmit.length === 0) {
						  pdk.uploadCompleteCallback()

						  pdk.currentlyUploading = false

						  pdk.uploadCompleteCallback = null
						  pdk.uploadProgressCallback = null
						} else {
						  chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
							if (result['pdk-identifier'] !== '') {
							  pdk.uploadBundle(endpoint, serverKey, result['pdk-identifier'], xmitBundle, function () {
								pdk.updateDataPoints(toTransmit, function () {
								  pdk.currentlyUploading = false

								  pdk.uploadQueuedDataPoints(endpoint, serverKey, progressCallback, completeCallback)
								})
							  })
							}
						  })
						}
					  })
					} else {
					  xmitBundle.push(status)

					  console.log('[PDK] Created bundle of size ' + bundleLength + '.')

					  if (toTransmit.length === 0) {
						pdk.uploadCompleteCallback()

						pdk.currentlyUploading = false

						pdk.uploadCompleteCallback = null
						pdk.uploadProgressCallback = null
					  } else {
						chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
						  if (result['pdk-identifier'] !== '') {
							pdk.uploadBundle(endpoint, serverKey, result['pdk-identifier'], xmitBundle, function () {
							  pdk.updateDataPoints(toTransmit, function () {
								pdk.currentlyUploading = false

								pdk.uploadQueuedDataPoints(endpoint, serverKey, progressCallback, completeCallback)
							  })
							})
						  }
						})
					  }
					}
				  })
				})
			  })
			}
		  }

		  request.onerror = function (event) {
			console.log('[PDK] PDK database error')
			console.log(event)
		  }


      
      


      }

      countRequest.onerror = function () {
        console.log('[PDK] PDK database error retrieving record count')
        console.log(event)
      }
    })
  }

  pdk.updateDataPoints = function (dataPoints, complete) {
    if (dataPoints.length === 0) {
      complete()
    } else {
      pdk.openDatabase(function (db) {
        const dataPoint = dataPoints.pop()

        const request = db.transaction(['dataPoints'], 'readwrite')
          .objectStore('dataPoints')
          .put(dataPoint)

        request.onsuccess = function (event) {
          pdk.updateDataPoints(dataPoints, complete)
        }

        request.onerror = function (event) {
          console.log('The data has write has failed')
          console.log(event)

          pdk.updateDataPoints(dataPoints, complete)
        }
      }, function (error) {
        console.log(error)

        complete()
      })
    }
  }

  pdk.encryptFields = function (serverKey, localKey, payload) {
    for (const itemKey in payload) {
      const value = payload[itemKey]

      const toRemove = []

      if (itemKey.endsWith('*')) {
        const originalValue = '' + value

        payload[itemKey.replace('*', '!')] = originalValue

        const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
        const messageUint8 = nacl.util.decodeUTF8(JSON.stringify(value))

        const cipherBox = nacl.box(messageUint8, nonce, serverKey, localKey)

        const fullMessage = new Uint8Array(nonce.length + cipherBox.length)

        fullMessage.set(nonce)
        fullMessage.set(cipherBox, nonce.length)

        const base64FullMessage = nacl.util.encodeBase64(fullMessage)

        payload[itemKey] = base64FullMessage

        toRemove.push(itemKey)
      } else if (value != null && value.constructor.name === 'Object') {
        pdk.encryptFields(serverKey, localKey, value)
      } else if (value != null && Array.isArray(value)) {
        value.forEach(function (valueItem) {
          if (valueItem.constructor.name === 'Object') {
            pdk.encryptFields(serverKey, localKey, valueItem)
          }
        })
      }
    }
  }

  pdk.uploadBundle = function (endpoint, serverKey, userId, points, complete) {
    const manifest = chrome.runtime.getManifest()

    // const keyPair = nacl.box.keyPair()
    // const serverPublicKey = nacl.util.decodeBase64(serverKey)

    const userAgent = manifest.name + '/' + manifest.version + ' ' + navigator.userAgent

    for (let i = 0; i < points.length; i++) {
      const metadata = {}

      if (points[i].date === undefined) {
        points[i].date = (new Date()).getTime()
      }

      metadata.source = userId
      metadata.generator = points[i].generatorId + ': ' + userAgent
      metadata['generator-id'] = points[i].generatorId
      metadata.timestamp = points[i].date / 1000 // Unix timestamp
      // metadata['generated-key'] = nacl.util.encodeBase64(keyPair.publicKey)
      metadata.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      points[i]['passive-data-metadata'] = metadata

      // pdk.encryptFields(serverPublicKey, keyPair.secretKey, points[i])
    }

    const dataString = JSON.stringify(points, null, 2)

    /*
    fetch(endpoint, {
      method: 'POST',
      mode: 'cors', // no-cors, *cors, same-origin
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      redirect: 'follow', // manual, *follow, error
      referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      body: new URLSearchParams({
        'payload': dataString
      })
    }) // body data type must match "Content-Type" header
      .then(response => response.json())
      .then(function (data) {
        complete()
      })
      .catch((error) => {
        console.error('Error:', error)
      })
    */

    const byteArray = new TextEncoder().encode(dataString)
    const cs = new CompressionStream('gzip')
    const writer = cs.writable.getWriter()
    writer.write(byteArray)
    writer.close()

    const compressedResponse = new Response(cs.readable)

    compressedResponse.arrayBuffer()
      .then(function (buffer) {
        const compressedBase64 = blobToB64(buffer)

        fetch(endpoint, {
          method: 'POST',
          mode: 'cors', // no-cors, *cors, same-origin
          cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          redirect: 'follow', // manual, *follow, error
          referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
          body: new URLSearchParams({
            compression: 'gzip',
            payload: compressedBase64
          })
        }) // body data type must match "Content-Type" header
          .then(response => response.json())
          .then(function (data) {
            complete()
          })
          .catch((error) => {
            console.error('Error:', error)
          })
      })
  }

  return pdk
}

if (typeof define === 'undefined') {
  if (typeof window !== 'undefined') {
    window.PDK = pdkFunction()
  } else {
    PDK = pdkFunction() // eslint-disable-line no-global-assign, no-undef
  }
} else {
  PDK = define(pdkFunction) // eslint-disable-line no-global-assign, no-undef
}
