# Welcome to Remix!

- 📖 [Remix docs](https://remix.run/docs)

## Development

Run the dev server:

```shell
pnpm dev
```

## Deployment

First, build your app for production:

```sh
pnpm build
```

Then run the app in production mode:

```sh
pnpm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying Node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `npm run build`

- `build/server`
- `build/client`

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever css framework you prefer. See the [Vite docs on css](https://vitejs.dev/guide/features.html#css) for more information.

## Books Module

The `/books` section is generated automatically from MDX sources under `app/books`. Each book folder contains a `book.mdx` overview and a `chapters/` directory with numbered chapter files. A custom Vite plugin scans these directories at startup to expose structured data and lazy chapter loaders through the `virtual:book-data` module.

- Add a new book by creating `app/books/<book-id>/book.mdx` and placing chapter files in `app/books/<book-id>/chapters/`.
- Frontmatter fields such as `title`, `description`, `author`, `tags`, and `order` control the UI presentation.
- Restart the dev server or touch the files to trigger hot updates when adding or removing books.
