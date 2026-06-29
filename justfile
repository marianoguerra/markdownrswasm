set shell := ["nu", "-c"]

dist:
    wasm-pack build --target web
    cp resources/markdown.js pkg/
    cp resources/markdownrswasmwc.js pkg/
    cp resources/usageexample.js pkg/
    cp resources/index.html pkg/
    cp resources/streamingperf.js pkg/
    cp resources/streamingperf.html pkg/
    cp resources/astplayground.js pkg/
    cp resources/astplayground.html pkg/
    cp README.md pkg/

smoke-test: dist
    bun run tests/smoketest.js
    bun run tests/asttest.js
