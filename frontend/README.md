### To run dev server
1. Ensure `node` and `yarn` are installed. Check `package.json` for version details.
1. Run `yarn install` to install dependencies from `package.json`
1. Run `npm run dev` to start a development server running at [http://localhost:3000](http://localhost:3000).

### To use as a container
1. Copy and rename `docker-compose.override-dev-example.yml` to `docker-compose.override.yml`
1. Rebuild. The frontend container should be accessible from [http://localhost:3000](http://localhost:3000)