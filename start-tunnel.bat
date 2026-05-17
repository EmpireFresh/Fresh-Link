@echo off
echo ============================================
echo   FreshLink Pro - Cloudflare Tunnel
echo ============================================
echo.
echo Demarrage du tunnel Cloudflare...
echo L'URL publique s'affiche en dessous (https://xxx.trycloudflare.com)
echo Copiez cette URL dans votre site Netlify.
echo.
echo Pour arreter : fermer cette fenetre (Ctrl+C)
echo.
"C:\Users\Laptop\cloudflared.exe" tunnel --url http://localhost:3000
pause
