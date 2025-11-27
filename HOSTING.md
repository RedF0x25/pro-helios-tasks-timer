# Hosting *pro-helios-tasks-timer* on GitHub

This project is a static web application (HTML/CSS/JS only), so it can be served directly from GitHub Pages. Follow the steps below to publish it from your own repository (`https://github.com/xavihachem/helios-task-pro`).

## 1. Prepare your repository

1. Clone your repository locally if you have not already:
   ```bash
   git clone https://github.com/xavihachem/helios-task-pro.git
   ```
2. Copy the project files (e.g., `index.html`, `app.js`, `style.css`, `README.md`, this `HOSTING.md`, etc.) into that clone and commit the changes:
   ```bash
   git add .
   git commit -m "Add pro-helios-tasks-timer"
   git push origin main
   ```
   > Replace `main` with the branch you use, if different.

## 2. Enable GitHub Pages

1. In your browser, open `https://github.com/xavihachem/helios-task-pro`.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the branch that contains `index.html` (e.g., `main`) and the folder `/ (root)`.
5. Click **Save**. GitHub Pages will build and publish your site at `https://xavihachem.github.io/helios-task-pro/` (URL follows the pattern `https://<username>.github.io/<repo>/`).

## 3. Verify the deployment

1. Wait a minute or two for GitHub Pages to finish building.
2. Visit the published URL. You should see the *pro-helios-tasks-timer* UI running in the browser.
3. If the page fails to load, check **Settings → Pages → GitHub Pages** for build logs.

## 4. Updating the site later

1. Make changes locally.
2. Commit and push to the branch configured for GitHub Pages.
3. GitHub Pages automatically rebuilds and redeploys after each push. Refresh the public URL once the build completes.

That is all you need—no additional hosting provider or configuration is required because the app is purely static.
