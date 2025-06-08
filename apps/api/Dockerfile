# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM --platform=$BUILDPLATFORM oven/bun:1.2.10-alpine AS build
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM --platform=$BUILDPLATFORM build AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM --platform=$BUILDPLATFORM build AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# [optional] tests & build
ARG COMMIT_HASH
ENV COMMIT_HASH=$COMMIT_HASH
ENV NODE_ENV=production
RUN apk add --no-cache git
RUN bun run build:prod

# copy production dependencies and source code into final image
FROM --platform=$TARGETPLATFORM oven/bun:1.2.10-alpine AS release
COPY --from=prerelease /usr/src/app/out/ .
COPY --from=prerelease /usr/src/app/static ./static

# run the app
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "server.js" ]
