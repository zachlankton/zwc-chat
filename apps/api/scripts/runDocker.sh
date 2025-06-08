#!/bin/bash

docker stop zwc-chat-api-bun

set -e
docker run -d -p 3000:3000 --rm \
    --network zwc-chat-api-network \
    --name zwc-chat-api-bun \
    -e DB_HOST="zwc-chat-mongo" \
    -e DB_PORT="27017" \
		-e DEV="TRUE" \
    zwc-chat-api-bun

#loop to wait until nextjs is ready
ready=0
echo "Waiting for ZWC Chat API to become ready..."
set +e
until [ $ready == 1 ];
do
    curl -s http://localhost:3000/api/healthcheck > /dev/null
    if [ $? == 0 ]; then ready=1; fi;
    sleep 1
done
echo "ZWC Chat API is ready"
