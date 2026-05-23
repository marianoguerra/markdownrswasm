set shell := ["nu", "-c"]

dist:
    wasm-pack build --target web
    cp resources/markdown.js pkg/
    cp resources/markdownrswasmwc.js pkg/
    cp resources/usageexample.js pkg/
    cp resources/index.html pkg/

smoke-test: dist
    bun run tests/smoketest.js
