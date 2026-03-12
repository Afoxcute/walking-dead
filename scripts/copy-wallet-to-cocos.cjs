/**
 * Builds web3-api (RainbowKit wallet) and copies the bundle into Cocos game
 * build-templates and preview-templates so the game shows RainbowKit instead of Push.
 *
 * Run from repo root: node scripts/copy-wallet-to-cocos.cjs
 * Or: npm run copy-wallet (if added to root package.json)
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const web3ApiDir = path.join(repoRoot, "web3-api");
const distDir = path.join(web3ApiDir, "dist");
const buildTemplatesAssets = path.join(repoRoot, "gaming", "build-templates", "web-mobile", "assets");
const previewTemplatesAssets = path.join(repoRoot, "gaming", "preview-templates", "assets");

console.log("Building web3-api (RainbowKit wallet)...");
execSync("npm run build", { cwd: web3ApiDir, stdio: "inherit" });

if (!fs.existsSync(distDir)) {
  console.error("web3-api/dist not found. Build may have failed.");
  process.exit(1);
}

const distAssets = path.join(distDir, "assets");
if (!fs.existsSync(distAssets)) {
  console.error("web3-api/dist/assets not found.");
  process.exit(1);
}

const files = fs.readdirSync(distAssets);
const jsFile = files.find((f) => f.endsWith(".js") && f.startsWith("wallet"));
const cssFiles = files.filter((f) => f.endsWith(".css"));

if (!jsFile) {
  console.error("No wallet.js bundle found in dist/assets. Check vite build output.");
  process.exit(1);
}

// Old Push/ConnectKit chunk filenames — remove so only RainbowKit (wallet.js) runs
const OLD_WALLET_CHUNKS = [
  "index-f732781d.js",
  "index-edfaad89.js",
  "w3m-modal-aa86b2d1.js",
];

function removeOldWalletChunks(targetDir) {
  if (!fs.existsSync(targetDir)) return;
  OLD_WALLET_CHUNKS.forEach((name) => {
    const p = path.join(targetDir, name);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log("Removed old chunk:", name, "from", targetDir);
    }
  });
}

function copyAssets(targetDir) {
  removeOldWalletChunks(targetDir);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(path.join(distAssets, jsFile), path.join(targetDir, "wallet.js"));
  cssFiles.forEach((f) => {
    fs.copyFileSync(path.join(distAssets, f), path.join(targetDir, "wallet.css"));
  });
  console.log("Copied wallet bundle to", targetDir);
}

copyAssets(buildTemplatesAssets);
copyAssets(previewTemplatesAssets);

const walletScriptTag = '<script type="module" crossorigin src="assets/wallet.js"></script>';
const walletCssTag = '<link rel="stylesheet" type="text/css" href="assets/wallet.css"/>';

function updateIndexHtml(htmlPath, addCssInHead) {
  if (!fs.existsSync(htmlPath)) return;
  let html = fs.readFileSync(htmlPath, "utf8");
  if (html.includes("assets/wallet.js")) {
    console.log(htmlPath, "already uses wallet.js");
    return;
  }
  html = html.replace(
    /<script type="module" crossorigin src="assets\/index-f732781d\.js"><\/script>/,
    walletScriptTag
  );
  if (addCssInHead && html.includes("</head>") && !html.includes("wallet.css")) {
    html = html.replace("</head>", "  " + walletCssTag + "\n</head>");
  }
  fs.writeFileSync(htmlPath, html);
  console.log("Updated", htmlPath);
}

updateIndexHtml(path.join(repoRoot, "gaming", "build-templates", "web-mobile", "index.html"), true);
updateIndexHtml(path.join(repoRoot, "gaming", "preview-templates", "index.html"), true);

console.log("Done. Re-open the Cocos project or refresh Preview to see RainbowKit.");
