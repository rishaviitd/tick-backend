#!/bin/bash

# Check for commit message
if [ -z "$1" ]; then
  echo "❌ Commit message required."
  echo "Usage: ./gitpush.sh \"Your commit message\""
  exit 1
fi

# Git workflow
git add .
git commit -m "$1"
git push origin main
