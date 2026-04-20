# FreshFold Laundry Web App

A modern, responsive, mobile-first Single Page Application (SPA) designed for a laundry pickup and delivery service in Nairobi, Kenya.

**Tagline**: “We Pick It Up • We Clean It • We Bring It Back Fresh”

## Core Features
1. **Multi-Page Simulation**: Routes managed entirely via `window.location.hash`, creating a smooth, App-like feel without a bundler.
2. **Vanilla JS & Tailwind via CDN**: No heavy frameworks, purely vanilla JavaScript and Tailwind utility classes for performance and simplicity.
3. **Multi-step Booking Flow**: State-persisted 4-step wizard for placing an order. Includes dynamic price calculation.
4. **Mocked Backend**: Complete `localStorage` integration that simulates a Supabase database. Orders, user details, and services persist across reloads.
5. **M-PESA Simulation**: Simulated lipana.dev STK push process with a loading overlay.
6. **Order Tracking**: Visual timeline for order statuses with an interactive "Demo Advance Status" feature to test tracking.

## Running Locally

Because this project uses vanilla HTML, CSS, and JS, it requires a local web server to run correctly (to circumvent CORS restrictions on `file://` protocols and allow `hashchange` routing to work optimally).

If you have Node.js installed, you can simply run:
\`\`\`bash
npx serve
\`\`\`
Then open `http://localhost:3000` in your browser. (We recommend opening developer tools and toggling mobile view for the best experience).

## Project Structure

- `index.html`: The main and only HTML shell.
- `js/app.js`: Global configuration and main router.
- `js/booking.js`: Logic for the 4-step wizard.
- `js/orders.js`: Logic for listing and tracking orders.
- `js/profile.js`: Account page and login simulation.
- `js/demo-data.js`: Injects seed database items into `localStorage`.
- `js/utils.js`: Helper functions and Toast UI system.

## Deployment to Vercel via GitHub

1. Ensure the code is committed to a GitHub repository:
   \`\`\`bash
   git init
   git add .
   git commit -m "Initial commit for FreshFold Laundry"
   git branch -M main
   git remote add origin https://github.com/yourusername/freshfold-laundry.git
   git push -u origin main
   \`\`\`
2. Sign in to [Vercel](https://vercel.com).
3. Click **Add New Project**.
4. Import the "freshfold-laundry" repository.
5. Leave the "Framework Preset" as **Other**.
6. Set the "Build Command" to empty (since this is purely static HTML/JS).
7. Set the "Output Directory" to root (`.`).
8. Click **Deploy**. In less than a minute, your app will be live globally!

## Future Improvements for Developer
- **Supabase Integration**: Replace `AppUtils.getStorage` and `AppUtils.setStorage` with Supabase JavaScript client `.from('x').select()` and `.insert()`.
- **Lipa na M-PESA**: Hook the `simulatePayment()` method up to your backend script that hits the Daraja API endpoint.
- **Maps**: Replace the image placeholders with real Leaflet map wrappers inside the render template.
