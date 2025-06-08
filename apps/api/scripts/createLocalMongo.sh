#!/bin/bash

docker container inspect zwc-chat-mongo > /dev/null
if [ $? == 0 ]; then exit 1; fi;

docker network create zwc-chat-api-network

set -e
echo "Creating new local mongo container"
docker run --name "zwc-chat-mongo" \
  --rm \
  --network zwc-chat-api-network \
  -e MONGO_INITDB_ROOT_USERNAME="zwc-chat" \
  -e MONGO_INITDB_ROOT_PASSWORD="asdfasdf" \
  -e MONGO_INITDB_DATABASE="zwc-chat" \
  -p 27017:27017 \
  -d mongo
if [ $? == 0 ]; then echo "New Container Started Successfully"; fi;
