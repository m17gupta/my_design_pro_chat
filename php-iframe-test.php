<?php
/**
 * PHP iframe embed test for the Next.js chat app.
 * Place this file in your PHP web root: e.g. /var/www/html/php-iframe-test.php
 * Then open: http://localhost/php-iframe-test.php
 *
 * The Next.js app must be running at http://localhost:3000
 * (run: npm run dev -- -p 3000  inside the chat-app directory)
 */

// The URL of your Next.js app — adjust if running on a different port
$nextjsUrl = "http://localhost:3000/enterprise";
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dzinly Chat — PHP Embed Test</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: #1e293b;
      padding: 12px 24px;
      border-bottom: 1px solid #334155;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    header h1 { font-size: 1rem; font-weight: 600; color: #f1f5f9; }
    .status {
      margin-left: auto;
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 9999px;
      background: #22c55e20;
      color: #22c55e;
      border: 1px solid #22c55e40;
    }
    .iframe-wrapper { flex: 1; }
    iframe {
      width: 100%;
      height: calc(100vh - 49px);
      border: none;
      display: block;
    }
    .error-box {
      display: none;
      margin: 20px;
      padding: 16px 20px;
      background: #7f1d1d30;
      border: 1px solid #f87171;
      border-radius: 8px;
      color: #fca5a5;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>🏠 PHP App &rarr; Dzinly Chat (Next.js iframe)</h1>
    <span class="status" id="status">Loading&hellip;</span>
  </header>
  <div class="error-box" id="error-box">
    The iframe could not load. Make sure the Next.js app is running:
    cd chat-app &amp;&amp; npm run dev -- -p 3000
  </div>
  <div class="iframe-wrapper">
    <iframe
      id="chat-iframe"
      src="<?= htmlspecialchars($nextjsUrl) ?>"
      title="Dzinly Chat App"
      allow="camera; microphone; clipboard-write"
      onload="document.getElementById('status').textContent='Loaded';"
      onerror="document.getElementById('error-box').style.display='block'; document.getElementById('status').textContent='Error';"
    ></iframe>
  </div>
</body>
</html>
