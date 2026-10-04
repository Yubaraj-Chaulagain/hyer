ZIP-STROGE SECURE SETUP
=========================

Files:
- index.html  -> website UI
- api.php     -> server-side GitHub API proxy
- config.php  -> GitHub token and repository settings

SETUP:
1. Upload all 3 files to the same folder on your PHP hosting.
2. Open config.php.
3. Replace:
   PASTE_YOUR_NEW_GITHUB_TOKEN_HERE
   with your new GitHub fine-grained token.
4. Keep the token ONLY inside config.php.
5. Make sure PHP cURL is enabled on the hosting.
6. Open index.html (or rename it to index.php if your hosting requires it).

GitHub token permissions:
- Repository access: only Yubaraj-Chaulagain/Zip-Stroge
- Contents: Read and write

IMPORTANT:
- Do NOT put the token in index.html.
- Do NOT send the token in chat.
- If the token is revoked/expired, replace it only in config.php.
