# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run test -- --runInBand && npm run typecheck && npm run export:web

FROM busybox:stable AS checks
COPY --from=build /app/dist /web
ENTRYPOINT ["/bin/true"]
