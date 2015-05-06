#!/bin/bash
redis="redis://localhost:6379/1"
warcprox --redis-dedup-url $redis -z -d ./ -p 9002 --prefix rec -m -i --rollover-idle-time 1200 --redis-dupe-timeout 10

#warcprox --warc-per-url -z -p 9001 -d ./ --rollover-idle-time 60 -j ./dedup.db --read-buff-size 1000000 -n rec --certs-dir ./certs/ --base32 --cacert ./ca-cert.pem
