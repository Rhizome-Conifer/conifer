#!/bin/sh

# GET recordings
echo curl "http://localhost:8080/api/v1/recordings?u=proust4eva&c=proust-over-http"
echo
echo "--------------------------------------------------------------------------------"
curl  "http://localhost:8080/api/v1/recordings?u=proust4eva&c=proust-over-http"
echo
echo "--------------------------------------------------------------------------------"
echo
echo curl  "http://localhost:8080/api/v1/recordings?u=@anon&c=anonymous"
echo
echo "--------------------------------------------------------------------------------"
curl  "http://localhost:8080/api/v1/recordings?u=@anon&c=anonymous"
echo
echo "--------------------------------------------------------------------------------"
echo

# POST recordings
echo curl -i --data "title=something new"  "http://localhost:8080/api/v1/recordings?c=anonymous&u=@anon"
echo
echo "--------------------------------------------------------------------------------"
curl -i --data "title=something new"  "http://localhost:8080/api/v1/recordings?c=anonymous&u=@anon"
echo
echo "--------------------------------------------------------------------------------"
echo

echo curl -i --data "title=something new"  "http://localhost:8080/api/v1/recordings?c=proust-over-http&u=proust4eva"
echo
echo "--------------------------------------------------------------------------------"
curl -i --data "title=something new"  "http://localhost:8080/api/v1/recordings?c=proust-over-http&u=proust4eva"
echo
echo "--------------------------------------------------------------------------------"
echo
