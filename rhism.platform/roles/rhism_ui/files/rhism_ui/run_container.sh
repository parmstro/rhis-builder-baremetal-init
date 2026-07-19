#!/bin/bash

inventorydir="/home/ansiblerunner/rhis/rhis-builder-inventory"
deploymentdir=""
certdir=""
port="8080"
registry="quay.io"
repo="parmstro"
image="rhis-builder-ui"
tag="latest"

while [[ "$#" -gt 0 ]]; do
    case "$1" in
        -i|--inventory-dir)
            inventorydir="$2"
            shift
            ;;
        -d|--deployment-dir)
            deploymentdir="$2"
            shift
            ;;
        -c|--cert-dir)
            certdir="$2"
            shift
            ;;
        -p|--port)
            port="$2"
            shift
            ;;
        -r|--registry)
            registry="$2"
            shift
            ;;
        -R|--repo)
            repo="$2"
            shift
            ;;
        --image)
            image="$2"
            shift
            ;;
        --tag)
            tag="$2"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
    shift
done

if [[ $inventorydir == "" ]]; then
    echo "ERROR: --inventory-dir is required (path to rhis-builder-inventory)"
    exit 1
fi

if [[ $repo == "" ]]; then
    path="$registry/$image"
else
    path="$registry/$repo/$image"
fi

echo
echo "Launching rhis-builder-ui container"
echo "  Image:          $path:$tag"
echo "  Inventory:      $inventorydir"
echo "  Deployments:    ${deploymentdir:-'(not set — export will download files)'}"
echo "  Certs:          ${certdir:-'(not set — HTTP only)'}"
echo "  Port:           $port"
echo

cert_mount=""
cert_env=""
if [[ -n "$certdir" ]]; then
    cert_mount="-v $certdir:/certs:Z"
    cert_env="-e TLS_KEY=/certs/server.key -e TLS_CERT=/certs/server.crt"
fi

deployment_mount=""
deployment_env=""
if [[ -n "$deploymentdir" ]]; then
    deployment_mount="-v $deploymentdir:/deployments:Z"
    deployment_env="-e DEPLOYMENT_PATH=/deployments"
fi

# Loopback-only publish — added by rhism (owner rule: this UI must always
# be restricted to only the machine it runs on). The original -p $port:$port
# publishes on ALL host interfaces by podman's own default; -p 127.0.0.1:...
# publishes on the host's loopback interface only, matching the app-layer fix
# in backend/src/index.js (which now also binds to 127.0.0.1, not 0.0.0.0) —
# both layers agree, so there's no path to network exposure at either one.
podman run -it --rm \
    -v "$inventorydir":/inventory:ro,Z \
    -e CATALOG_PATH=/inventory/schema/soe_catalog \
    $deployment_mount \
    $deployment_env \
    $cert_mount \
    $cert_env \
    -e PORT=$port \
    -e HOST=0.0.0.0 \
    -p 127.0.0.1:$port:$port \
    --hostname rhis-builder-ui \
    --name rhis-builder-ui \
    "$path:$tag"

if [ "$(uname)" == "Linux" ]; then
    restorecon -FRq "$inventorydir"
    [[ -n "$deploymentdir" ]] && restorecon -FRq "$deploymentdir"
    [[ -n "$certdir" ]]       && restorecon -FRq "$certdir"
fi
