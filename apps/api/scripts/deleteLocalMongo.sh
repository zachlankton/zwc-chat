#!/bin/bash

echo "Stopping and removing local mongo container"
docker stop zwc-chat-mongo
# docker rm zwc-chat-mongo