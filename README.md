
`bash_functions.sh` contains some functions that help you extract the sites js/html content from a HAR file & unminify it, also contains a function to extract any source maps if present.<br>
Intended Workflow:
- open devtools
- check "Preserve Log" & "Disable Cache" in network tab
- crawl the site manually
- hit the "Export HAR" button when done crawling
- than run the unhar function like this `unhar www.redacted.com.har`
- if there are sourcemaps also run `srcmap www.redacted.com.har`
- Go to the `Dev Tools > Sources > Override` and add the extracted folder from the HAR file
- Now refresh the page with Dev Tools open and all your dynamic analysis tools will report unminified stacktraces.

<br>

Dependencies:
```bash
go install github.com/tomnomnom/unfurl@latest
```
```bash
npm install -g js-beutify
```
```bash
npm install -g html-beutify
```
```bash
go install github.com/denandz/sourcemapper@latest
```

<br>

`postMessage-tracker` this is Frans Rosen's extension with a few changes, original [here](https://github.com/fransr/postMessage-tracker).
<br>
Changes:
- Logs message content (not just message handlers) to webhook
- Filters postMessage handlers registered by extensions
- Filters postMessages in the console coming from the following extensions
  - DOMInvador
  - DOMLogger++
  - Wappalyzer
  - UntrustedTypes
- syntax highlighting
- removes stacktrace lines that come from stack frames of this extension

<br>

`hashChange-tracker` just a rip off of postMessage-tracker but for hashchange event

<p align="center">
  <img src="https://github.com/aristosMiliaressis/js-analysis-tools/blob/master/images/hashChange-tracker.png?raw=true">
</p>

<br>

`iframe-tracker` just a rip off of postMessage-tracker but for tracking and revealing iframes
- also supports send iframes & the fully rendered DOM to a webhook
  
<p align="center">
  <img src="https://github.com/aristosMiliaressis/js-analysis-tools/blob/master/images/iframe-tracker.png?raw=true">
</p>