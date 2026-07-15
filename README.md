# Pocket MC Telemetry Dashboard

A real-time telemetry dashboard designed for Pocket MC. This dashboard visualizes live, anonymous analytics regarding client installations, active server statistics, and global usage data.

## Architecture and Technology Stack

The project is built entirely as a static frontend web application with a focus on high performance and zero external dependencies (aside from mapping). It is designed to run efficiently in any modern web browser.

- **Frontend Core:** Pure HTML, CSS, and Vanilla JavaScript.
- **Data Fetching:** The dashboard periodically polls a designated JSON API endpoint to retrieve the latest live statistics. 
- **Mapping:** Vector maps are rendered using jsvectormap.
- **PWA Support:** A Service Worker (`sw.js`) and Web App Manifest (`manifest.json`) are included, allowing users to install the dashboard as a Progressive Web App on mobile and desktop platforms.

## Local Development

Because this is a purely static site, no build steps or package managers are required.

1. Clone the repository to your local machine.
2. Serve the directory using any local HTTP server. For example, if you have Python installed, you can run:
   ```bash
   python -m http.server 8000
   ```
3. Open your browser and navigate to `http://localhost:8000`.

*Note: Opening `index.html` directly from the file system (via `file://` protocol) may cause issues with the Service Worker and module loading due to browser security restrictions.*

## Deployment

This repository is optimized for deployment on static hosting platforms such as GitHub Pages, Cloudflare Pages, or Vercel. 

For GitHub Pages, a GitHub Actions workflow is provided in `.github/workflows/deploy.yml` which automatically deploys the `master` branch to the `gh-pages` environment.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
