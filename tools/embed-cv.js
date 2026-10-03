// Usage: node tools/embed-cv.js
// Re-embeds Faizan_Akbar_CV.pdf (project root) into index.html so the Download CV button serves your new CV.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const pdf = fs.readFileSync(path.join(root, "Faizan_Akbar_CV.pdf")).toString("base64");
const file = path.join(root, "index.html");
const html = fs.readFileSync(file, "utf8");
const re = /(<script type="text\/plain" id="cvdata">)[\s\S]*?(<\/script>)/;
if (!re.test(html)) { console.error("cvdata block not found in index.html"); process.exit(1); }
fs.writeFileSync(file, html.replace(re, (_, a, b) => a + pdf + b));
console.log("CV embedded:", Math.round(pdf.length / 1024), "KB (base64)");
