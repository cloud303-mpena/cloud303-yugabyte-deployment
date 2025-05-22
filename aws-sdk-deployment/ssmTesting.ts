import * as resGen from "./resource-generator";

// Current error that needs to be solved: https://docs.aws.amazon.com/sdk-for-ruby/v3/api//Aws/SSM/Types/InvalidInstanceId.html
// Current fix, enable SSM in web console

resGen.configureYugabyteNodes(
    "i-0857c191a73733e8e",
    "ubuntu",
    "us-east-1",
    ["us-east-1a", "us-east-1b", "us-east-1c"],
    ["10.0.0.215", "10.0.1.208", "10.0.2.109"],
    3
);