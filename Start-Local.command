#!/bin/zsh
cd -- "${0:A:h}" || exit 1
npm run dev -- --host 127.0.0.1 --port 5280 --strictPort
