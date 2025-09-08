const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🏗️ Building project...');
execSync('npm run build', { stdio: 'inherit' });

console.log('📁 Reading built files...');
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('❌ Error: No se encontró index.html en la carpeta dist/');
  process.exit(1);
}

const indexContent = fs.readFileSync(indexPath, 'utf-8');

// Encontrar el archivo JS compilado
const jsMatch = indexContent.match(/<script type="module" crossorigin src="(\.\/assets\/index-[^"]+\.js)"><\/script>/);
if (jsMatch && jsMatch[1]) {
  const jsPath = jsMatch[1];
  console.log(`📦 Found compiled JS: ${jsPath}`);
  
  // Crear el index.html para iOS
  const iosHTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <base href="./">
    <title>Kashless</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${jsPath}"></script>
    
    <!-- 🔍 ERROR OVERLAY: muestra cualquier error JS en pantalla -->
    <script>
    (function () {
      function show(msg) {
        var d = document.createElement('div');
        d.style.position='fixed'; d.style.inset='0'; d.style.zIndex='999999';
        d.style.background='#111'; d.style.color='#fff'; d.style.padding='16px';
        d.style.font='14px/1.4 -apple-system,system-ui,sans-serif';
        d.style.overflow='auto'; d.style.whiteSpace='pre-wrap';
        d.innerHTML = '<b>⚠️ JavaScript error</b><hr><div>'+String(msg)+'</div>';
        document.body.appendChild(d);
      }
      window.addEventListener('error', function (e) {
        if (e.error) { show(e.error.stack || e.error.message || e.error); return; }
        if (e.target && e.target.tagName === 'SCRIPT') { show('Failed to load script: ' + (e.target.src || '(inline)')); return; }
        show(e.message || 'Unknown error');
      }, true);
      window.addEventListener('unhandledrejection', function (e) {
        var r = e.reason || e;
        show('Unhandled rejection: ' + (r.stack || r.message || r));
      });
      console.log('[OVERLAY] ready');
    })();
    </script>

    <!-- Registro del Service Worker: no lo hagas en nativo -->
    <script>
      (function() {
        const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
        if (!isNative && 'serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker
              .register('/sw.js')
              .then(() => console.log('✅ SW registrado'))
              .catch(err => console.error('❌ Error registrando SW:', err));
          });
        }
      })();
    </script>
  </body>
</html>`;

  // Guardar el archivo para iOS
  fs.writeFileSync(indexPath, iosHTML);
  console.log('✅ Updated index.html with correct JS path');

  // Copiar a iOS
  console.log('📱 Copying to iOS...');
  execSync('npx cap sync ios', { stdio: 'inherit' });
  
  console.log('🎉 Done! Now open Xcode: npx cap open ios');
} else {
  console.error('❌ Error: No se pudo encontrar el script compilado en index.html');
  process.exit(1);
}