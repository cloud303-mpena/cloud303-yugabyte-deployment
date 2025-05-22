import * as resGen from "./resource-generator";

// Current error that needs to be solved: https://docs.aws.amazon.com/sdk-for-ruby/v3/api//Aws/SSM/Types/InvalidInstanceId.html
// Current fix, enable SSM in web console

resGen.configureYugabyteNodes(
    "i-08cedcf2853fa161c",
    "ubuntu",
    "us-east-1",
    ["us-east-1a", "us-east-1b", "us-east-1c"],
    ["10.0.0.151", "10.0.1.66", "10.0.2.130"],
    3
);