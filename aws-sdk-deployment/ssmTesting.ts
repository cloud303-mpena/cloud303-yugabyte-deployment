import * as resGen from "./resource-generator";

resGen.configureYugabyteNodes(
    "i-0ff61147c6d68c9f0",
    "ubuntu",
    "us-east-1",
    ["us-east-1a", "us-east-1b", "us-east-1c"],
    ["3.228.180.155", "35.170.38.163", "3.233.61.75"],
    3
);