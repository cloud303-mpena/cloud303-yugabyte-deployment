import * as resGen from "./resource-generator";

resGen.configureYugabyteNodes(
    "i-092c8deb4d414017c",
    "ubuntu",
    "us-east-1",
    ["us-east-1a", "us-east-1b", "us-east-1c"],
    ["54.146.36.185", "54.210.78.231", " 44.218.5.173"],
    3
);