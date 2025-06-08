# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM --platform=$BUILDPLATFORM oven/bun:1.2.10-alpine AS build
WORKDIR /usr/src/app

COPY . .

# [optional] tests & build
ARG COMMIT_HASH
ENV COMMIT_HASH=$COMMIT_HASH
ENV NODE_ENV=production
RUN apk add --no-cache git
RUN bun install

# run the app
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "dev" ]
