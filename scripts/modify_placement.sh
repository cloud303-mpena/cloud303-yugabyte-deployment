#!/bin/bash
set -e

REGION="$1"
ZONES="$2"
RF="$3"
MASTER_ADDRS="$4"

if [ -z "$REGION" ] || [ -z "$ZONES" ] || [ -z "$RF" ] || [ -z "$MASTER_ADDRS" ]; then
  echo "Usage: $0 <region> <zones> <replication_factor> <master_addrs>"
  echo "Note: <zones> should be a comma-separated list of availability zones"
  exit 1
fi

# Build the placement info string
PLACEMENT_INFO=""
IFS=',' read -ra ZONE_ARRAY <<< "$ZONES"
for i in "${ZONE_ARRAY[@]}"; do
  if [ -z "$PLACEMENT_INFO" ]; then
    PLACEMENT_INFO="aws.$REGION.$i"
  else
    PLACEMENT_INFO="$PLACEMENT_INFO,aws.$REGION.$i"
  fi
done

# Execute the command with the built placement info
./bin/yb-admin \
  --master_addresses "$MASTER_ADDRS" \
  modify_placement_info \
  "$PLACEMENT_INFO" "$RF"