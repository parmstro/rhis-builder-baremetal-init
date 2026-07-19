#!/bin/bash

registry="quay.io"
repo="parmstro"
image="rhis-builder-ui"
tag="latest"

while [[ "$#" -gt 0 ]]; do
    case "$1" in
        -r|--registry)
            registry="$2"
            shift
            ;;
        -R|--repo)
            repo="$2"
            shift
            ;;
        -i|--image)
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

if [[ $repo == "" ]]; then
    path="$registry/$image"
else
    path="$registry/$repo/$image"
fi

echo
echo "Building rhis-builder-ui container"
echo "  Image: $path:$tag"
echo

podman build -t "$path:$tag" .

if [ $? -ne 0 ]; then
    echo "ERROR: Build failed"
    exit 1
fi

echo
echo "Pushing $path:$tag to registry..."
podman push "$path:$tag"

if [ $? -ne 0 ]; then
    echo "ERROR: Push failed"
    exit 1
fi

echo
echo "Done. Image available at $path:$tag"
