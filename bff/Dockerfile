# Build context = repo root:  docker build -f bff/Dockerfile -t almond-bff .
FROM node:22-alpine
WORKDIR /app
# Workspace manifests first (better layer caching).
COPY package.json package-lock.json ./
COPY packages ./packages
COPY almond-app/package.json ./almond-app/package.json
COPY almond-web/package.json ./almond-web/package.json
COPY bff ./bff
RUN npm install --legacy-peer-deps --ignore-scripts
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
# Runs the TypeScript entry directly via tsx (no build step).
CMD ["npm", "start", "-w", "@almond/bff"]
