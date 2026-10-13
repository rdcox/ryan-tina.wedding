# ryan-tina.wedding

Wedding site for Ryan & Tina. Vite + TypeScript + three.js, deployed to GitHub Pages.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and build to dist/
npm run preview  # serve the production build locally
```

## Deploy

Push to `main`. The workflow in `.github/workflows/deploy.yml` builds the site and publishes it to GitHub Pages. The custom domain is set by `public/CNAME`; DNS lives in Route53.

## Where things are

- `index.html` – the page content. Edit copy here.
- `src/style.css` – colours, type, layout.
- `src/main.ts` – the three.js background scene.
