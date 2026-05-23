import init from "../pkg/markdownrswasm.js";
import { mdToHtml } from "../pkg/markdownrswasm.js";

await init();
console.log(mdToHtml("## Hi, *Saturn*! 🪐"));
console.log(
  mdToHtml(`
  # Dangerous HTML Example

  Hello world, this is normal markdown

  <script>
    alert("XSS Attack!");
    document.cookie = "stolenCookie="+document.cookie;
  </script>

  <iframe src="javascript:alert('Iframe XSS')"></iframe>

  <img src="x" onerror="alert('Image XSS')">

  <a href="javascript:alert('Link XSS')">Click me</a>

  <div onclick="alert('Event handler XSS')">Click here too</div>

  <style>
    body {
      background: url("javascript:alert('CSS XSS')");
    }
  </style>

  <form action="javascript:alert('Form XSS')">
    <button>Submit</button>
  </form>
`),
);
