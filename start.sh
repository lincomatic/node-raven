#!/bin/bash
cd /home/borkdork/node-raven
export PATH=./node-v20.9.0-linux-x64/bin:$PATH
cd example
rm nohup.out
nohup node raven.js &

