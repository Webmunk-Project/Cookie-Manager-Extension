# Cookie Manager Extension

Cookie Manager is a Chrome Manifest V3 extension that implements an experimental intervention (standardizing and varying cookie pop-ups) and data collection mechanism to support research in online Internet usage patterns. It is constructed using the Webmunk modular framework, which allows it to reuses and share functional modules in order to encourage deduplication and code reuse.

## Building Cookie Manager

Before building the extension, please verify that you have **a functional Python 3 environment** available. The build script that constructs the final deliverable extension uses Python to combine the source extension and included modules into the final form that may be distributed as an unpacked extension or uploaded to the Google's Chrome Web Store.

After checking out this repository and the included Git submodules, create the extension with the command
```
python3 package_chrome.py --dir
```
The `--dir` parameter instructs the build script to leave the `chrome-extension` directory in the folder. This contains an unpacked version of the extension that is suitable for loading directly from Chrome's Extensions manager.

## Starting Cookie Manager

After building and loading the extension, the extension will prompt you to enter an e-mail address to get started. 

<p align="center" width="100%">
    <img src="https://github.com/Webmunk-Project/Cookie-Manager-Extension/blob/main/documentation/images/setup_email.png?raw=true">
</p>

<p align="center" width="100%">
    <img src="https://github.com/Webmunk-Project/Cookie-Manager-Extension/blob/main/documentation/images/setup_successful.png?raw=true">
</p>

This is used to generate and fetch a configuration from the server that will control the behavior of the extension. 

<p align="center" width="100%">
    <img src="https://github.com/Webmunk-Project/Cookie-Manager-Extension/blob/main/documentation/images/extension_main.png?raw=true">
</p>

The extension then displays its main screen that includes your unique identifier as well as a toolbar with four actions in the upper-right:

* Upload Data: Immediately begins the data upload process to the server, instead of waiting for the regular timed background schedule.
* Refresh Rules: Immediately queries the server for a fresh configuraton, instead of waiting for the regular timed background schedule.
* Inspect Rules: Displays the current configuration in use in JSON format.
* Open Settings: Opens a settings pane where user-accessible settings may reside. (Not currently in use.)

<p align="center" width="100%">
    <img src="https://github.com/Webmunk-Project/Cookie-Manager-Extension/blob/main/documentation/images/extension_rules.png?raw=true" alt="Cookie Manager rules inspector">
</p>

If you inspect the rules, you will see a variety of extension parameters mixed with module configurations. Extension parameters consist of the following:

* `description`: A list of lines displayed on the main screen. Used as a general method to provide more information and context to users.
* `enroll-url`: The URL used to enroll new users (using e-mail addresses) and to fetch the latest configuration, which may change over time, based on the research design.
* `pending-tasks-label`: List header for server-based tasks that may be assigned to users. (Not currently in use.)
* `tasks`: A list of incomplete user tasks fetched from the server. (Not currently in use.)
* `uninstall-url`: The URL of the web endpoint that is contacted when users remove the extension.
* `upload-url`: The HTTP endpoint where observational data is to be transmitted.

In order to enable secure research designs where users identifying data is stored separately from observational data, this extension communicates with two servers:

* Enrollment server (`enroll-url`): Stores identifying information such as e-mail addresses and associates that information with a configuration that may be retrieved, even if the user uninstalls and reinstalls the extension.
* Data collection server (`upload-url`): Data collection point using Passive Data Kit where observational data is transmitted. Data sent to this server is identified using the numeric identifier - the e-mail address and other identifiable data is **not** sent to this server.

## Webmunk Modules

The remainder of the extension's configuration consists of directives to the Webmunk modules that are enabled in the extension. Webmunk modules consists of independent components that provide services to the extension that may be reused across extensions and research projects. To inspect the modules enabled in the extension, see the `modules` key of the `manifest.json` file. Note that modules are typically delivered as standalone Git repositories, and updates to module may be pushed and pulled as appropriate.

The following sections describe the modules in use.

### Cookie UI

This module incorporates a modified build of DuckDuckGo's AutoConsent engine in order to detect cookie manager pop-ups (CMPs) and to replace the cookie consent interfaces provided by the pages themselves with a standardized user interface designed to minimize design differences across sites. An example configuration:
```
  "cookie-ui": {
    "always-display-ui": true,
    "auto-action": "doNothing",
    "detect-retries": 1,
    "disabled-cmps": [],
    "enable-prehide": true,
    "enabled": true,
    "url-overrides": {
      "example.com": {
        "always-display-ui": true,
        "detect-retries": 0,
        "enable-prehide": true,
        "ui-configuration-override": "accept-reject"
      }
    }
  }
```
This configuration hides native cookie UI elements as soon as possible (`enable-prehide`) and will not take any automatic action on behalf of the user (`auto-action`). It always displays a cookie pop-up on sites that set cookies (`always-display-ui`) and visits to the `example.com` domain will override the built-in UI randomization (`ui-configuration-override`) to always show an interface with just an "Accept" and "Reject" button.

This module reports to the data server a series of events describing the user action taken in choosing their per-site cookie preferences.

### Cookies

This is a simple module that reports back to the server all the cookies that are set on a given page.

### Search Mirror

When the user visits a search page, this module records their search queries and results that are returned to them. When secondary sites are enabled, this module will also execute the same search on different search engines and record the results accordingly.

A basic configuration:
```
  "search-mirror": {
    "enabled": true,
    "primary-sites-example": [
      "google",
      "bing",
      "duckduckgo"
    ],
    "secondary-sites-example": [
      "google",
      "bing",
      "duckduckgo"
    ]
  }
```

This configuration captures searches from the Google, Bing, and DuckDuckGo and will also capture background searches on those various sites.

### Ad Scraper

This module is dedicated to capturing information about ads present on a page. Where possible, it attempts to not only capture the presence of an ad on a page, but also its content, capturing images and text, as well as traversing IFRAMEs. (This module is still under construction.)

## More Information

This project is still under very active developemnt and for any outstanding questions or comments, please contact Chris Karr via e-mail at [chris@audacious-software.com](mailto:chris@audacious-software.com).
