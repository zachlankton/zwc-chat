#!/bin/bash

docker container inspect zwc-chat-mongo > /dev/null
if [ $? == 0 ]; then exit 1; fi;

docker network create zwc-chat-api-network

set -e
echo "Creating new local mongo container"
docker run --name "zwc-chat-mongo" \
  --rm \
  --network zwc-chat-api-network \
  -e MONGO_INITDB_ROOT_USERNAME="zwc-chat-dev" \
  -e MONGO_INITDB_ROOT_PASSWORD="asdfasdfasdf" \
  -e MONGO_INITDB_DATABASE="zwc-chat-dev" \
  -p 27017:27017 \
  -d mongo
if [ $? == 0 ]; then echo "New Container Started Successfully"; fi;
