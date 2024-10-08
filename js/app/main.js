/* global requirejs, chrome */

// const PDK_TOTAL_UPLOADED = 'pdk-total-uploaded'

requirejs.config({
  shim: {
    jquery: {
      exports: '$'
    },
    bootstrap: {
      deps: ['jquery']
    }
  },
  baseUrl: 'vendor/js',
  paths: {
    app: '../../js/app',
    pdk: '../../js/lib/passive-data-kit',
    bootstrap: '../../vendor/js/bootstrap.bundle',
    moment: '../../vendor/js/moment.min',
    material: '../../vendor/js/material-components-web'
  }
})

requirejs(['material', 'moment', 'pdk', 'jquery'], function (mdc, moment, pdk) {
  requirejs(['app/home', 'app/config'], function (home, config) {
    document.documentElement.style.setProperty('--mdc-theme-primary', config.primaryColor)
    document.documentElement.style.setProperty('--mdc-theme-secondary', config.accentColor)

    document.title = config.extensionName

    $('#extensionTitle').text(config.extensionName)
    $('#valueUploadUrl').text(config.uploadUrl)
    $('#valueAboutExtension').html(config.aboutExtension)

    mdc.tooltip.MDCTooltip.attachTo(document.querySelector('#actionCloseScreenTooltip'))
    mdc.tooltip.MDCTooltip.attachTo(document.querySelector('#actionOpenSettingsTooltip'))
    mdc.tooltip.MDCTooltip.attachTo(document.querySelector('#actionReloadRulesTooltip'))
    mdc.tooltip.MDCTooltip.attachTo(document.querySelector('#actionUploadDataTooltip'))
    mdc.tooltip.MDCTooltip.attachTo(document.querySelector('#actionInspectRulesTooltip'))

    const displayMainUi = function () {
      $('.page-panel').hide()
      $('#detailsScreen').show()

      $('#extensionTitle').html('Cookie Manager')

      $('#actionReloadRules').hide()
      $('#actionInspectRules').hide()
      $('#actionUploadData').show()
      $('#actionOpenSettings').hide()
      $('#actionCloseScreen').hide()

      $('.main-ui-button').show()

      chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
        if (result['pdk-identifier'] === '') {
          $('#valueIndentifier').text('Unknown')
        } else {
          $('#valueIndentifier').text(result['pdk-identifier'])
        }
      })

      chrome.storage.local.get({ 'pdk-last-upload': '' }, function (result) {
        if (result['pdk-last-upload'] === '') {
          $('#valueLastUpload').text('Never')
        } else {
          $('#valueLastUpload').text(moment(result['pdk-last-upload']).format('llll'))
        }
      })

      chrome.runtime.sendMessage({ content: 'fetch_configuration' }, function (extensionConfig) {
        if (extensionConfig.tasks === undefined || extensionConfig.tasks.length === 0) {
          let descriptionHtml = ''

          extensionConfig.description.forEach(function (line) {
            if (descriptionHtml !== '') {
              descriptionHtml += '<br /><br />'
            }

            descriptionHtml += line
          })

          $('#valueDescription').html(descriptionHtml)

          $('#mainTasks').hide()
          $('#mainDescription').show()
        } else {
          let tasksHtml = '<ul style="padding-right: 40px;">'

          extensionConfig.tasks.forEach(function (task) {
            tasksHtml += '<li><p><a href="' + task.url + '" target="_blank" style="text-decoration: none;">' + task.message + '</a></p></li>'
          })

          tasksHtml += '</ul>'

          tasksHtml += '<p class="mdc-typography--caption">Tasks will be removed after completion (it may take a few hours).</p>'

          $('#valueTasks').html(tasksHtml)

          if (extensionConfig['pending-tasks-label'] !== undefined) {
            $('#pendingTasksTitle').html(extensionConfig['pending-tasks-label'])
          } else {
            $('#pendingTasksTitle').html('Pending Tasks')
          }

          $('#valueTasks').html(tasksHtml)

          $('#mainDescription').hide()
          $('#mainTasks').show()
        }
      })

      pdk.enqueueDataPoint('cookie-manager-extension-action', {
        action: 'show-main-screen'
      }, function () {})
    }

    const displaySettingsUi = function () {
      $('.page-panel').hide()
      $('#settingsScreen').show()

      $('.toolbar-button').hide()
      $('.settings-button').show()

      $('#extensionTitle').html('Settings')

      pdk.enqueueDataPoint('cookie-manager-extension-action', {
        action: 'show-settings'
      }, function () {})
    }

    const displayRulesUi = function () {
      $('.page-panel').hide()
      $('#rulesScreen').show()

      $('.toolbar-button').hide()
      $('.inspect-rules-button').show()

      $('#extensionTitle').html('Inspect Rules')

      pdk.enqueueDataPoint('cookie-manager-extension-action', {
        action: 'show-rules'
      }, function () {})
    }

    const dialog = mdc.dialog.MDCDialog.attachTo(document.querySelector('#dialog'))

    const displayIdentifierUi = function () {
      $('.page-panel').hide()
      $('#loginScreen').show()

      $('.toolbar-button').hide()

      $('#extensionTitle').html('Get Started')

      let identifierValidated = false
      let identifier = null

      $('#submitIdentifier').click(function (eventObj) {
        eventObj.preventDefault()
        identifier = $('#identifier').val()

        home.validateIdentifier(identifier, function (title, message, newIdentifier, data) {
          $('#dialog-title').text(title)
          $('#dialog-content').html(message)

          identifier = newIdentifier

          identifierValidated = true

          chrome.storage.local.set({
            'cookie-manager-config': data.rules
          }, function (result) {
            dialog.open()
          })
        }, function (title, message) {
          $('#dialog-title').text(title)
          $('#dialog-content').text(message)

          dialog.open()

          identifierValidated = false
        })
      })

      const completeFunction = function (event) {
        if (identifierValidated) {
          chrome.storage.local.set({
            'pdk-identifier': identifier
          }, function (result) {
            dialog.unlisten('MDCDialog:closed', completeFunction)

            displayMainUi()
          })
        }
      }

      dialog.listen('MDCDialog:closed', completeFunction)
    }

    chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
      if (result['pdk-identifier'] === '') {
        displayIdentifierUi()
      } else {
        displayMainUi()
      }
    })

    /* eslint-disable no-unused-vars */

    const appBar = mdc.topAppBar.MDCTopAppBar.attachTo(document.querySelector('.mdc-top-app-bar'))
    const identifierField = mdc.textField.MDCTextField.attachTo(document.querySelector('#field_identifier'))
    const rulesJsonField = mdc.textField.MDCTextField.attachTo(document.querySelector('#rulesDefinitionJson'))

    const validateRules = function () {
      try {
        const newRules = JSON.parse(rulesJsonField.value)

        $('#rulesJsonState').removeClass('rules-error')
        $('#rulesJsonState').addClass('rules-ok')
        $('#rulesJsonState').html('Valid JSON.')

        if (newRules.rules.length !== undefined) {
          $('#rulesCount').html(newRules.rules.length + ' rule(s)')
        } else {
          $('#rulesCount').html('Unable to count rules.')
        }

        if (Object.keys(newRules.actions).length !== undefined) {
          $('#actionsCount').html(Object.keys(newRules.actions).length + ' action set(s)')
        } else {
          $('#actionsCount').html('Unable to count action sets.')
        }

        return true
      } catch (error) {
        $('#rulesJsonState').addClass('rules-error')
        $('#rulesJsonState').removeClass('rules-ok')

        $('#rulesJsonState').html('Invalid JSON.')
        $('#rulesCount').html('')
        $('#cssCount').html('')
        $('#actionsCount').html('')
      }

      return false
    }

    mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'))

    $('#actionCloseScreen').click(function (eventObj) {
      eventObj.preventDefault()

      pdk.enqueueDataPoint('cookie-manager-extension-action', {
        action: 'close-screen'
      }, function () {})

      displayMainUi()

      return false
    })

    $('#actionOpenSettings').click(function (eventObj) {
      eventObj.preventDefault()

      pdk.enqueueDataPoint('cookie-manager-extension-action', {
        action: 'open-settings'
      }, function () {})

      displaySettingsUi()

      $('#actionCloseScreen').show()

      return false
    })

    window.onresize = function () {
      const statusHeight = $('#rulesScreenStatus').outerHeight()

      const verticalPadding = $('#rulesDefinitionJsonFrame').outerHeight() - $('#rulesDefinitionJsonFrame .mdc-layout-grid__inner').outerHeight()

      $('#rulesDefinitionJson').height(window.innerHeight - verticalPadding - 64 - statusHeight)
      $('#rulesScreenStatus').css('padding', '8px')
      $('#rulesScreenStatus').css('padding-left', (verticalPadding / 2) + 'px')
      $('#rulesScreenStatus').css('padding-right', (verticalPadding / 2) + 'px')

      $('body').css('height', '100vh').css('overflow-y', 'hidden')
    }

    $('#actionInspectRules').click(function (eventObj) {
      eventObj.preventDefault()

      pdk.enqueueDataPoint('cookie-manager-extension-action', {
        action: 'inspect-rules'
      }, function () {})

      chrome.runtime.sendMessage({ content: 'fetch_configuration' }, function (message) {
        rulesJsonField.value = JSON.stringify(message, null, 2)

        validateRules()

        displayRulesUi()

        window.onresize()
      })

      return false
    })

    $('#rulesDefinitionJson textarea').on('input selectionchange propertychange', function () {
      validateRules()
    })

    $('#actionReloadRules').click(function (eventObj) {
      eventObj.preventDefault()

      pdk.enqueueDataPoint('cookie-manager-extension-action', {
        action: 'reload-rules'
      }, function () {})

      $('#actionReloadRules').text('sync')

      chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
        const payload = {}

        if (result['pdk-identifier'] !== '') {
          payload.identifier = result['pdk-identifier']
        }

        chrome.runtime.sendMessage({ content: 'refresh_configuration', payload: payload }, function (extensionConfig) { // eslint-disable-line object-shorthand
          if (extensionConfig !== null) {
            $('#dialog-title').text('Rules updated')
            $('#dialog-content').text('Fetched updated rules successfully.')

            dialog.open()

            $('#actionReloadRules').text('refresh')

            displayMainUi()
          } else {
            $('#dialog-title').text('Error refreshing rules')
            $('#dialog-content').text('An error was encountered refreshing the rules. Please verify that you have a working Internet connection.')

            dialog.open()

            $('#actionReloadRules').text('sync_problem')
          }
        })
      })

      return false
    })

    let uploading = false

    const uploadDialog = mdc.dialog.MDCDialog.attachTo(document.querySelector('#upload_data_dialog'))
    uploadDialog.scrimClickAction = ''
    uploadDialog.escapeKeyAction = ''

    const uploadProgress = mdc.linearProgress.MDCLinearProgress.attachTo(document.querySelector('#upload-data-dialog-progress'))

    $('#actionUploadData').click(function (eventObj) {
      eventObj.preventDefault()

      pdk.enqueueDataPoint('cookie-manager-extension-action', {
        action: 'upload-data'
      }, function () {})

      if (uploading === false) {
        $('#actionUploadData').text('cloud_sync')

        uploading = true

        let initialPendingItems = -1

        chrome.runtime.sendMessage({ content: 'fetch_configuration' }, function (extensionConfig) {
          pdk.uploadQueuedDataPoints(extensionConfig['upload-url'], extensionConfig.key, function (pendingItems) {
            let completed = 0

            if (initialPendingItems < 0) {
              initialPendingItems = pendingItems

              completed = initialPendingItems - pendingItems

              if (completed < 0) {
                completed = 0
              }

              $('#upload-data-dialog-message').html(pendingItems + ' of ' + initialPendingItems + ' remaining.')

              uploadProgress.determinate = true

              uploadProgress.progress = completed / initialPendingItems

              uploadProgress.open()

              uploadDialog.open()
            }

            uploadProgress.determinate = true

            completed = initialPendingItems - pendingItems

            if (completed < 0) {
              completed = 0
            }

            uploadProgress.progress = completed / initialPendingItems

            $('#upload-data-dialog-message').html(pendingItems + ' of ' + initialPendingItems + ' remaining.')
          }, function () {
            uploadDialog.close()

            $('#actionUploadData').text('cloud_upload')

            $('#dialog-title').text('Data uploaded')
            $('#dialog-content').text('Data uploaded successfully.')

            chrome.storage.local.set({
              'pdk-last-upload': (new Date().getTime())
            }, function (result) {
              displayMainUi()
            })

            dialog.open()

            uploading = false
          })
        })
      }

      return false
    })

    $('#resetExtension').click(function (eventObj) {
      eventObj.preventDefault()

      // TODO

      return false
    })
  })
})
