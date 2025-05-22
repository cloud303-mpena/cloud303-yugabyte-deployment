"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptForParams = promptForParams;
exports.createSSMInstanceRole = createSSMInstanceRole;
exports.createEC2Instance = createEC2Instance;
exports.associateInstanceProfileWithEc2 = associateInstanceProfileWithEc2;
exports.getPrimaryPrivateIpAddress = getPrimaryPrivateIpAddress;
exports.waitForInstanceRunning = waitForInstanceRunning;
exports.createVpc = createVpc;
exports.createSubnets = createSubnets;
exports.createYugaByteSecurityGroup = createYugaByteSecurityGroup;
exports.createInternetGatewayAndRouteTable = createInternetGatewayAndRouteTable;
exports.createSubnetRouteTableAssociations = createSubnetRouteTableAssociations;
exports.createNetworkInterfaceWithPublicIP = createNetworkInterfaceWithPublicIP;
exports.configureYugabyteNodes = configureYugabyteNodes;
exports.getAvailableAZs = getAvailableAZs;
exports.buildNetworkConfig = buildNetworkConfig;
exports.createAndSaveKeyPair = createAndSaveKeyPair;
var client_ec2_1 = require("@aws-sdk/client-ec2");
var client_ssm_1 = require("@aws-sdk/client-ssm");
var inquirer_1 = require("inquirer");
var client_iam_1 = require("@aws-sdk/client-iam");
var fs_1 = require("fs");
var path_1 = require("path");
var DEFAULTS = {
    DBVersion: "2024.2.2.1-b190",
    RFFactor: 3,
    NumberOfNodes: 3,
    KeyName: "",
    InstanceType: "t3.medium",
    LatestAmiId: "/aws/service/canonical/ubuntu/server/jammy/stable/current/amd64/hvm/ebs-gp2/ami-id",
    SshUser: "ubuntu",
    DeploymentType: "Multi-AZ",
    Region: "us-east-1",
};
var INSTANCE_TYPES = ["t3.medium", "c5.xlarge", "c5.2xlarge"];
var DEPLOYMENT_TYPES = ["Multi-AZ", "Single-Server", "Multi-Region"];
/**
 * Prompts the user for Yugabyte deployment parameters using interactive CLI inputs.
 *
 * @returns {Promise<YugabyteParams>} A promise that resolves to an object containing the user's input for deployment parameters.
 */
function promptForParams() {
    return __awaiter(this, void 0, void 0, function () {
        var answers;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "DBVersion",
                            message: "DBVersion",
                            default: DEFAULTS.DBVersion,
                        },
                        {
                            type: "input",
                            name: "NumberOfNodes",
                            message: "Number of Nodes",
                            default: String(DEFAULTS.NumberOfNodes),
                        },
                        {
                            type: "input",
                            name: "RFFactor",
                            message: "RFFactor",
                            default: String(DEFAULTS.RFFactor),
                            //RF must be odd
                            validate: function (input) { return (parseInt(input, 10) % 2 == 1); }
                        },
                        {
                            type: "input",
                            name: "KeyName",
                            message: "KeyName",
                            default: "YugabyteKey",
                            validate: function (input) { return (input ? true : "KeyName is required."); },
                        },
                        {
                            type: "list",
                            name: "InstanceType",
                            message: "Select Instance Type",
                            choices: INSTANCE_TYPES,
                            default: DEFAULTS.InstanceType,
                        },
                        {
                            type: "input",
                            name: "LatestAmiId",
                            message: "LatestAmiId",
                            default: DEFAULTS.LatestAmiId,
                        },
                        {
                            type: "input",
                            name: "SshUser",
                            message: "SshUser",
                            default: DEFAULTS.SshUser,
                        },
                        {
                            type: "list",
                            name: "DeploymentType",
                            message: "Select Deployment Type",
                            choices: DEPLOYMENT_TYPES,
                            default: DEFAULTS.DeploymentType,
                        },
                        {
                            type: "input",
                            name: "Region",
                            message: "Region",
                            default: DEFAULTS.Region,
                        },
                    ])];
                case 1:
                    answers = _a.sent();
                    return [2 /*return*/, answers];
            }
        });
    });
}
/**
 * Initializes EC2 client in the right region
* @param {region} - region to initialize the client in
*
*/
// export async function initEC2Client(region: string) {
//   ec2Client = new EC2Client({region: region})
// }
/**
 * Creates an IAM role and instance profile with SSM permissions for EC2 instances.
 *
 * This function performs the following operations:
 * 1. Creates an IAM role with EC2 trust relationship
 * 2. Attaches the AmazonSSMManagedInstanceCore policy to the role
 * 3. Creates an instance profile with the same name as the role
 * 4. Adds the role to the instance profile
 * 5. Retrieves and returns the ARN of the created instance profile
 *
 * @param {string} roleName - The name to use for both the IAM role and instance profile
 * @returns {Promise<string>} A promise that resolves to the ARN of the created instance profile
 * @throws {Error} If any of the IAM operations fail during role or profile creation
 */
function createSSMInstanceRole(roleName) {
    return __awaiter(this, void 0, void 0, function () {
        var iamClient, assumeRolePolicyDocument, error_1, getInstanceProfileResponse, instanceProfileArn;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    iamClient = new client_iam_1.IAMClient();
                    assumeRolePolicyDocument = JSON.stringify({
                        Version: "2012-10-17",
                        Statement: [
                            {
                                Effect: "Allow",
                                Principal: {
                                    Service: "ec2.amazonaws.com",
                                },
                                Action: "sts:AssumeRole",
                            },
                        ],
                    });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 6, , 7]);
                    // Create IAM Role
                    return [4 /*yield*/, iamClient.send(new client_iam_1.CreateRoleCommand({
                            RoleName: roleName,
                            AssumeRolePolicyDocument: assumeRolePolicyDocument,
                        }))];
                case 2:
                    // Create IAM Role
                    _b.sent();
                    // Attach AmazonSSMManagedInstanceCore Policy
                    return [4 /*yield*/, iamClient.send(new client_iam_1.AttachRolePolicyCommand({
                            RoleName: roleName,
                            PolicyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
                        }))];
                case 3:
                    // Attach AmazonSSMManagedInstanceCore Policy
                    _b.sent();
                    // Create Instance Profile (required for EC2 attachment)
                    return [4 /*yield*/, iamClient.send(new client_iam_1.CreateInstanceProfileCommand({
                            InstanceProfileName: roleName,
                        }))];
                case 4:
                    // Create Instance Profile (required for EC2 attachment)
                    _b.sent();
                    // Add Role to Instance Profile
                    return [4 /*yield*/, iamClient.send(new client_iam_1.AddRoleToInstanceProfileCommand({
                            InstanceProfileName: roleName,
                            RoleName: roleName,
                        }))];
                case 5:
                    // Add Role to Instance Profile
                    _b.sent();
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _b.sent();
                    //TODO: change to make sure the error is that it already exists
                    if (error_1.name === "EntityAlreadyExistsException") {
                    }
                    return [3 /*break*/, 7];
                case 7: return [4 /*yield*/, iamClient.send(new client_iam_1.GetInstanceProfileCommand({
                        InstanceProfileName: roleName,
                    }))];
                case 8:
                    getInstanceProfileResponse = _b.sent();
                    instanceProfileArn = (_a = getInstanceProfileResponse.InstanceProfile) === null || _a === void 0 ? void 0 : _a.Arn;
                    console.log("Created EC2 IAM role and instance profile: ".concat(roleName, " with ARN: ").concat(instanceProfileArn));
                    return [2 /*return*/, instanceProfileArn || ""];
            }
        });
    });
}
/**
 * Creates an EC2 instance with specified configurations and waits until it is running.
 *
 * @param {string} name - The name to assign to the EC2 instance.
 * @param {string} region - The AWS region where the instance will be created.
 * @param {string} instanceType - The type of instance to create (e.g., t2.micro).
 * @param {string} imageId - The ID of the AMI to use for the instance.
 * @param {string} keyName - The name of the key pair to use for SSH access.
 * @param {string} netIntId - The network interface ID to associate with the instance.
 * @param {boolean} [isMasterNode=false] - Flag indicating if the instance is a master node.
 * @param {string[]} masterNetIntIds - List of network interface IDs for master nodes.
 * @param {string} zone - The availability zone for the instance.
 * @param {string} sshUser - The SSH username for accessing the instance.
 *
 * @returns {Promise<{instanceId: string, privateIpAddress: string, isMasterNode: boolean}>}
 * An object containing the instance ID, private IP address, and master node status.
 *
 * @throws Will throw an error if the instance creation fails.
 */
function createEC2Instance(name_1, region_1, instanceType_1, imageId_1, keyName_1, netIntId_1) {
    return __awaiter(this, arguments, void 0, function (name, region, instanceType, imageId, keyName, netIntId, isMasterNode, masterNetIntIds, zone, sshUser) {
        var ec2Client, blockDeviceMappings, nodePrivateIp, masterPrivateIps, instanceParams, command, data, instance, instanceId, privateIpAddress, publicIp, err_1;
        var _a;
        var _b;
        if (isMasterNode === void 0) { isMasterNode = false; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 8, , 9]);
                    blockDeviceMappings = [
                        {
                            DeviceName: "/dev/xvda",
                            Ebs: {
                                VolumeSize: 50,
                                DeleteOnTermination: true,
                                VolumeType: "gp2",
                            },
                        },
                    ];
                    return [4 /*yield*/, getPrimaryPrivateIpAddress(region, netIntId)];
                case 2:
                    nodePrivateIp = _c.sent();
                    return [4 /*yield*/, Promise.all(masterNetIntIds.map(function (id) { return getPrimaryPrivateIpAddress(region, id, false); }))];
                case 3:
                    masterPrivateIps = _c.sent();
                    _a = {
                        Name: name
                    };
                    return [4 /*yield*/, getAmiIdFromSSM(imageId)];
                case 4:
                    instanceParams = (_a.ImageId = _c.sent(),
                        _a.InstanceType = instanceType,
                        _a.MinCount = 1,
                        _a.MaxCount = 1,
                        _a.KeyName = keyName,
                        _a.NetworkInterfaces = [
                            {
                                DeviceIndex: 0,
                                NetworkInterfaceId: netIntId,
                            },
                        ],
                        _a.BlockDeviceMappings = blockDeviceMappings,
                        _a.UserData = Buffer.from(generateUserData(isMasterNode, masterPrivateIps, zone || "".concat(region, "a"), region, sshUser, nodePrivateIp)).toString("base64"),
                        _a);
                    command = new client_ec2_1.RunInstancesCommand(instanceParams);
                    return [4 /*yield*/, ec2Client.send(command)];
                case 5:
                    data = _c.sent();
                    instance = (_b = data.Instances) === null || _b === void 0 ? void 0 : _b[0];
                    instanceId = instance === null || instance === void 0 ? void 0 : instance.InstanceId;
                    privateIpAddress = instance === null || instance === void 0 ? void 0 : instance.PrivateIpAddress;
                    console.log("Successfully created EC2 instance with ID: ".concat(instanceId));
                    console.log("Instance is ".concat(isMasterNode ? "a MASTER" : "a TSERVER", " node"));
                    console.log("Waiting for running state...");
                    return [4 /*yield*/, (0, client_ec2_1.waitUntilInstanceRunning)({ client: ec2Client, maxWaitTime: 1000 }, { InstanceIds: [instanceId] })];
                case 6:
                    _c.sent();
                    console.log("Instance ".concat(name, " is running!"));
                    if (!instanceId) {
                        throw new Error("Instance ID is undefined.");
                    }
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.DescribeNetworkInterfacesCommand({ NetworkInterfaceIds: [netIntId] }))
                            .then(function (res) { var _a, _b, _c; return (_c = (_b = (_a = res.NetworkInterfaces) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.Association) === null || _c === void 0 ? void 0 : _c.PublicIp; })];
                case 7:
                    publicIp = _c.sent();
                    return [2 /*return*/, {
                            instanceId: instanceId,
                            privateIpAddress: privateIpAddress,
                            publicIp: publicIp,
                            isMasterNode: isMasterNode,
                        }];
                case 8:
                    err_1 = _c.sent();
                    console.error("Error creating EC2 instance:", err_1);
                    throw err_1;
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * Associates an IAM instance profile with a specified EC2 instance.
 *
 * @param {string} instanceId - The ID of the EC2 instance to associate with the instance profile.
 * @param {string} instanceProfileArn - The ARN of the IAM instance profile to associate with the EC2 instance.
 * @param {string} region - region of where the ec2 instance lives
 * @returns {Promise<void>} A promise that resolves when the association is complete.
 *
 * This function logs the association process and uses the AWS SDK to send the
 */
function associateInstanceProfileWithEc2(instanceId, instanceProfileArn, region) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Associating instance ".concat(instanceId, " with instance profile ").concat(instanceProfileArn));
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.AssociateIamInstanceProfileCommand({
                            IamInstanceProfile: {
                                Arn: instanceProfileArn,
                            },
                            InstanceId: instanceId,
                        }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Retrieves the primary private IP address associated with a specified network interface.
 *
 * @param {string} networkInterfaceId - The ID of the network interface to query.
 * @param {boolean} doPrint - Whether or not to print the ip
 * @param {string} region - Region to initialize ec2Client
 * @returns {Promise<string>} A promise that resolves to the primary private IP address of the network interface.
 *
 * @throws Will throw an error if the network interface is not found or if no primary private IP address is available.
 *
 * This function utilizes the EC2 client to send a DescribeNetworkInterfacesCommand and logs the process.
 */
function getPrimaryPrivateIpAddress(region_1, networkInterfaceId_1) {
    return __awaiter(this, arguments, void 0, function (region, networkInterfaceId, doPrint) {
        var ec2Client, response, primaryPrivateIpAddress, error_2;
        if (doPrint === void 0) { doPrint = true; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.DescribeNetworkInterfacesCommand({
                            NetworkInterfaceIds: [networkInterfaceId],
                        }))];
                case 2:
                    response = _a.sent();
                    // Check if we got a valid response
                    if (!response.NetworkInterfaces ||
                        response.NetworkInterfaces.length === 0) {
                        throw new Error("Network interface ".concat(networkInterfaceId, " not found"));
                    }
                    primaryPrivateIpAddress = response.NetworkInterfaces[0].PrivateIpAddress;
                    if (!primaryPrivateIpAddress) {
                        throw new Error("No primary private IP address found for network interface ".concat(networkInterfaceId));
                    }
                    if (doPrint) {
                        console.log("Primary private IP address for ".concat(networkInterfaceId, ": ").concat(primaryPrivateIpAddress));
                    }
                    return [2 /*return*/, primaryPrivateIpAddress];
                case 3:
                    error_2 = _a.sent();
                    console.error("Error getting primary private IP address for network interface ".concat(networkInterfaceId, ":"), error_2);
                    throw error_2;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Generates user data script for EC2 instances in a cluster configuration.
 *
 * Creates a customized initialization script based on whether the node is a master node
 * or a worker node, incorporating network configuration, and SSH access.
 *
 * @param {boolean} isMasterNode - Whether this node is a master node in the cluster
 * @param {string[]} masterPrivateIps - Array of private IP addresses of all master nodes
 * @param {string} zone - The availability zone where the instance is deployed
 * @param {string} region - The AWS region where the instance is deployed
 * @param {string} sshUser - The username for SSH access to be configured on the instance
 * @param {string} nodePrivateIp - The private IP address of the node being configured
 * @returns {string} Base64 encoded user-data script for initialization
 *
 */
function generateUserData(isMasterNode, masterPrivateIps, zone, region, sshUser, nodePrivateIp) {
    // Format master addresses for YugaByteDB configuration
    var masterAddresses = masterPrivateIps.map(function (ip) { return "".concat(ip, ":7100"); }).join(",");
    return "#!/bin/bash -xe\napt-get update -y\napt-get install -y python3-pip\n\n# Install required software\ncd /home/".concat(sshUser, "\nwget https://software.yugabyte.com/releases/2024.2.2.2/yugabyte-2024.2.2.2-b2-linux-x86_64.tar.gz\ntar xvfz yugabyte-2024.2.2.2-b2-linux-x86_64.tar.gz\ncd yugabyte-2024.2.2.2/\n./bin/post_install.sh\n\n# Download configuration scripts\ncd /home/").concat(sshUser, "\ncurl -o install_software.sh https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/install_software.sh\ncurl -o start_master.sh https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/start_master.sh\ncurl -o start_tserver.sh https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/start_tserver.sh\ncurl -o set_replica_policy.sh https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/set_replica_policy.sh\nchmod +x *.sh\nbash install_software.sh\n\n# Run the appropriate node setup script based on node type\ncd /home/").concat(sshUser, "/yugabyte-2024.2.2.2\n").concat(isMasterNode
        ? "sudo -u ".concat(sshUser, " /home/").concat(sshUser, "/start_master.sh ").concat(nodePrivateIp, " ").concat(zone, " ").concat(region, " /home/").concat(sshUser, " '").concat(masterAddresses, "'\nsudo -u ").concat(sshUser, " /home/").concat(sshUser, "/start_tserver.sh ").concat(nodePrivateIp, " ").concat(zone, " ").concat(region, " /home/").concat(sshUser, " '").concat(masterAddresses, "'")
        : "sudo -u ".concat(sshUser, " /home/").concat(sshUser, "/start_tserver.sh ").concat(nodePrivateIp, " ").concat(zone, " ").concat(region, " /home/").concat(sshUser, " '").concat(masterAddresses, "'"), "\n");
}
/**
 * Waits for an EC2 instance to reach the 'running' state and logs its public IP.
 * Uses the built-in AWS SDK waitUntilInstanceRunning waiter.
 *
 * @param region - The AWS region where the instance exists
 * @param instanceId - The ID of the EC2 instance to wait for
 * @returns A promise that resolves when the instance is running
 */
function waitForInstanceRunning(region, instanceId) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, describeCommand, data, instance, publicIp, err_2;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    console.log("Waiting for instance ".concat(instanceId, " to be in 'running' state..."));
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 4, , 5]);
                    // Use the built-in waiter to wait for the instance to be running
                    return [4 /*yield*/, (0, client_ec2_1.waitUntilInstanceRunning)({
                            client: ec2Client,
                            // Optional configuration
                            maxWaitTime: 300, // 5 minutes maximum wait time
                            minDelay: 2, // Min seconds between attempts
                            maxDelay: 10, // Max seconds between attempts
                        }, { InstanceIds: [instanceId] })];
                case 2:
                    // Use the built-in waiter to wait for the instance to be running
                    _d.sent();
                    describeCommand = new client_ec2_1.DescribeInstancesCommand({
                        InstanceIds: [instanceId],
                    });
                    return [4 /*yield*/, ec2Client.send(describeCommand)];
                case 3:
                    data = _d.sent();
                    instance = (_c = (_b = (_a = data.Reservations) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.Instances) === null || _c === void 0 ? void 0 : _c[0];
                    publicIp = instance === null || instance === void 0 ? void 0 : instance.PublicIpAddress;
                    console.log("Instance ".concat(instanceId, " is now running!"));
                    if (publicIp) {
                        console.log("Public IP address: ".concat(publicIp));
                    }
                    else {
                        console.log("No public IP address assigned to instance ".concat(instanceId));
                    }
                    return [2 /*return*/, { instanceId: instanceId, publicIp: publicIp }];
                case 4:
                    err_2 = _d.sent();
                    console.error("Error waiting for instance ".concat(instanceId, " to run:"), err_2);
                    throw err_2;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Creates an AWS VPC with the specified CIDR block and name tag.
 * @param {string} region - region to deploy the VPC in
 * @param {string} cidrBlock - The IPv4 CIDR block for the VPC
 * @returns {Promise<string | undefined>} The ID of the created VPC or undefined if creation fails
 */
function createVpc(region, cidrBlock) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, createVpcCommand, vpcResult, vpcId, err_3;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    createVpcCommand = new client_ec2_1.CreateVpcCommand({
                        CidrBlock: cidrBlock,
                    });
                    return [4 /*yield*/, ec2Client.send(createVpcCommand)];
                case 2:
                    vpcResult = _b.sent();
                    vpcId = (_a = vpcResult.Vpc) === null || _a === void 0 ? void 0 : _a.VpcId;
                    if (!vpcId)
                        throw new Error("Failed to retrieve VPC ID");
                    console.log("VPC created with ID: ".concat(vpcId));
                    return [2 /*return*/, vpcId];
                case 3:
                    err_3 = _b.sent();
                    console.error("Error creating VPC:", err_3);
                    return [2 /*return*/, undefined];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Creates subnets in the specified VPC using a mapping of CIDR blocks to availability zones.
 *
 * @param {string} vpcId - The ID of the VPC where subnets will be created
 * @param {string} region - Region to initialize ec2Client
 * @param {Object} cidrToAZ - Mapping of CIDR blocks to availability zones
 * @returns {Promise<string[]>} Array of created subnet IDs
 */
function createSubnets(vpcId, region, cidrToAZ) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, subnetIds, _i, _a, _b, cidr, az, subnetCommand, result, subnetId;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    subnetIds = [];
                    console.log("Creating subnets...");
                    _i = 0, _a = Object.entries(cidrToAZ);
                    _d.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    _b = _a[_i], cidr = _b[0], az = _b[1];
                    subnetCommand = new client_ec2_1.CreateSubnetCommand({
                        VpcId: vpcId,
                        AvailabilityZone: az,
                        CidrBlock: cidr,
                    });
                    return [4 /*yield*/, ec2Client.send(subnetCommand)];
                case 2:
                    result = _d.sent();
                    subnetId = (_c = result.Subnet) === null || _c === void 0 ? void 0 : _c.SubnetId;
                    if (subnetId) {
                        subnetIds.push(subnetId);
                        console.log("Created subnet ".concat(subnetId, " with CIDR ").concat(cidr, " in ").concat(az));
                    }
                    else {
                        console.warn("Failed to create subnet with CIDR ".concat(cidr, " in ").concat(az));
                    }
                    _d.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("Subnets created!");
                    return [2 /*return*/, subnetIds];
            }
        });
    });
}
/**
 * Creates a security group for YugabyteDB with the necessary inbound and outbound rules.
 *
 * @param {string} vpcId - The ID of the VPC where the security group will be created
 * @param {string} vpcCidr - The CIDR block of the VPC for configuring security group rules
 * @param {string} region - Region to initialize ec2Client
 * @returns {Promise<string>} The ID of the created security group
 */
function createYugaByteSecurityGroup(vpcId, vpcCidr, region) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, createSgParams, createSgResponse, securityGroupId, ingressRules, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    createSgParams = {
                        Description: "YugaByte Node Security Group",
                        GroupName: "YugaByteNodeSG",
                        VpcId: vpcId,
                        TagSpecifications: [
                            {
                                ResourceType: "security-group",
                                Tags: [
                                    {
                                        Key: "Name",
                                        Value: "YugaByteSecurityGroup",
                                    },
                                ],
                            },
                        ],
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.CreateSecurityGroupCommand(createSgParams))];
                case 2:
                    createSgResponse = _a.sent();
                    securityGroupId = createSgResponse.GroupId;
                    if (!securityGroupId) {
                        throw new Error("Failed to get security group ID after creation");
                    }
                    ingressRules = [
                        // SSH access
                        {
                            IpProtocol: "tcp",
                            FromPort: 22,
                            ToPort: 22,
                            IpRanges: [{ CidrIp: "0.0.0.0/0" }],
                        },
                        // YB Master RPC port
                        {
                            IpProtocol: "tcp",
                            FromPort: 7000,
                            ToPort: 7000,
                            IpRanges: [{ CidrIp: "0.0.0.0/0" }],
                        },
                        // YB Master HTTP port
                        {
                            IpProtocol: "tcp",
                            FromPort: 7100,
                            ToPort: 7100,
                            IpRanges: [{ CidrIp: vpcCidr }],
                        },
                        // YB TServer RPC port
                        {
                            IpProtocol: "tcp",
                            FromPort: 9000,
                            ToPort: 9000,
                            IpRanges: [{ CidrIp: "0.0.0.0/0" }],
                        },
                        // YB TServer HTTP port
                        {
                            IpProtocol: "tcp",
                            FromPort: 9100,
                            ToPort: 9100,
                            IpRanges: [{ CidrIp: vpcCidr }],
                        },
                        // YEDIS port
                        {
                            IpProtocol: "tcp",
                            FromPort: 6379,
                            ToPort: 6379,
                            IpRanges: [{ CidrIp: vpcCidr }],
                        },
                        // YSQL port
                        {
                            IpProtocol: "tcp",
                            FromPort: 5433,
                            ToPort: 5433,
                            IpRanges: [{ CidrIp: vpcCidr }],
                        },
                        // YCQL port
                        {
                            IpProtocol: "tcp",
                            FromPort: 9042,
                            ToPort: 9042,
                            IpRanges: [{ CidrIp: vpcCidr }],
                        },
                    ];
                    // Authorize the ingress rules
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.AuthorizeSecurityGroupIngressCommand({
                            GroupId: securityGroupId,
                            IpPermissions: ingressRules,
                        }))];
                case 3:
                    // Authorize the ingress rules
                    _a.sent();
                    console.log("Successfully created YugaByte security group: ".concat(securityGroupId));
                    return [2 /*return*/, securityGroupId];
                case 4:
                    error_3 = _a.sent();
                    console.error("Error creating YugaByte security group:", error_3);
                    throw error_3;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Creates an Internet Gateway, attaches it to a VPC, and creates a public route table
 * @param vpcId - The ID of the VPC to attach the Internet Gateway to
 * @param {string} region - Region to initialize ec2Client
 * @returns Promise resolving to the created resources' IDs
 */
function createInternetGatewayAndRouteTable(vpcId, region) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, createIgwResponse, internetGatewayId, createRouteTableResponse, routeTableId, error_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.CreateInternetGatewayCommand({}))];
                case 2:
                    createIgwResponse = _c.sent();
                    internetGatewayId = (_a = createIgwResponse.InternetGateway) === null || _a === void 0 ? void 0 : _a.InternetGatewayId;
                    if (!internetGatewayId) {
                        throw new Error("Failed to get Internet Gateway ID after creation");
                    }
                    // Step 3: Attach Internet Gateway to VPC
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.AttachInternetGatewayCommand({
                            InternetGatewayId: internetGatewayId,
                            VpcId: vpcId,
                        }))];
                case 3:
                    // Step 3: Attach Internet Gateway to VPC
                    _c.sent();
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.CreateRouteTableCommand({
                            VpcId: vpcId,
                        }))];
                case 4:
                    createRouteTableResponse = _c.sent();
                    routeTableId = (_b = createRouteTableResponse.RouteTable) === null || _b === void 0 ? void 0 : _b.RouteTableId;
                    if (!routeTableId) {
                        throw new Error("Failed to get Route Table ID after creation");
                    }
                    // Step 6: Create Public Route
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.CreateRouteCommand({
                            RouteTableId: routeTableId,
                            DestinationCidrBlock: "0.0.0.0/0",
                            GatewayId: internetGatewayId,
                        }))];
                case 5:
                    // Step 6: Create Public Route
                    _c.sent();
                    console.log("Successfully created Internet Gateway ".concat(internetGatewayId, " and Route Table ").concat(routeTableId, " for VPC ").concat(vpcId));
                    return [2 /*return*/, {
                            internetGatewayId: internetGatewayId,
                            routeTableId: routeTableId,
                        }];
                case 6:
                    error_4 = _c.sent();
                    console.error("Error creating Internet Gateway and Route Table:", error_4);
                    throw error_4;
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Associates a subnet with a route table
 * @param subnetId - The ID of the subnet to associate
 * @param routeTableId - The ID of the route table to associate with the subnet
 * @param {string} region - Region to initialize ec2Client
 * @returns Promise resolving to the association response
 */
function createSubnetRouteTableAssociations(subnetIds, routeTableId, region) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, associationResponses, _i, subnetIds_1, subnetId, associationResponse, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    associationResponses = [];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    _i = 0, subnetIds_1 = subnetIds;
                    _a.label = 2;
                case 2:
                    if (!(_i < subnetIds_1.length)) return [3 /*break*/, 5];
                    subnetId = subnetIds_1[_i];
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.AssociateRouteTableCommand({
                            SubnetId: subnetId,
                            RouteTableId: routeTableId,
                        }))];
                case 3:
                    associationResponse = _a.sent();
                    console.log("Successfully associated subnet ".concat(subnetId, " with route table ").concat(routeTableId));
                    console.log("Association ID: ".concat(associationResponse.AssociationId));
                    associationResponses.push(associationResponse);
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    console.log("Associated ".concat(subnetIds.length, " subnets with route table ").concat(routeTableId));
                    return [2 /*return*/, associationResponses];
                case 6:
                    error_5 = _a.sent();
                    console.error("Error associating subnets with route table ".concat(routeTableId, ":"), error_5);
                    throw error_5;
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Creates a network interface in the specified subnet with the provided security group,
 * and associates an Elastic IP address with it.
 *
 * @param subnetId - The subnet ID where the network interface will be created
 * @param securityGroupId - The security group to attach to the network interface
 * @param {string} region - Region to initialize ec2Client
 * @returns A promise resolving to an object containing the network interface ID and public IP address
 */
function createNetworkInterfaceWithPublicIP(subnetId, securityGroupId, region) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, createResponse, networkInterfaceId, allocateResponse, allocationId, publicIp, privateIp, error_6;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.CreateNetworkInterfaceCommand({
                            SubnetId: subnetId,
                            Groups: [securityGroupId],
                        }))];
                case 2:
                    createResponse = _c.sent();
                    networkInterfaceId = (_a = createResponse.NetworkInterface) === null || _a === void 0 ? void 0 : _a.NetworkInterfaceId;
                    if (!networkInterfaceId) {
                        throw new Error("Failed to get network interface ID after creation");
                    }
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.AllocateAddressCommand({
                            Domain: "vpc",
                        }))];
                case 3:
                    allocateResponse = _c.sent();
                    allocationId = allocateResponse.AllocationId;
                    publicIp = allocateResponse.PublicIp;
                    if (!allocationId || !publicIp) {
                        throw new Error("Failed to allocate Elastic IP");
                    }
                    privateIp = (_b = createResponse.NetworkInterface) === null || _b === void 0 ? void 0 : _b.PrivateIpAddress;
                    if (!privateIp) {
                        throw new Error("Failed to retrieve private IP from network interface");
                    }
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.AssociateAddressCommand({
                            AllocationId: allocationId,
                            NetworkInterfaceId: networkInterfaceId,
                            PrivateIpAddress: privateIp,
                        }))];
                case 4:
                    _c.sent();
                    console.log("Created network interface ".concat(networkInterfaceId, " in subnet ").concat(subnetId));
                    console.log("Associated Elastic IP ".concat(publicIp, " with the network interface"));
                    // Return both the network interface ID and the public IP
                    return [2 /*return*/, {
                            networkInterfaceId: networkInterfaceId,
                            publicIp: publicIp,
                        }];
                case 5:
                    error_6 = _c.sent();
                    console.error("Error creating network interface with public IP:", error_6);
                    throw error_6;
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Configures YugabyteDB nodes with appropriate replication settings and placement policies.
 * Uses ssm client to run bash command
 *
 * @param {string} instanceId - The EC2 instance ID of the YugabyteDB node
 * @param {string} sshUser - The SSH username for connecting to the instance
 * @param {string} region - The AWS region where the node is deployed
 * @param {string[]} zones - Array of availability zones used in the deployment
 * @param {string[]} masterAddresses - Array of YugabyteDB master addresses
 * @param {number} replicationFactor - The replication factor for YugabyteDB (default: 3)
 * @param {string} scriptUrl - URL to the configuration script (default: GitHub URL)
 */
function configureYugabyteNodes(instanceId_1, sshUser_1, region_1, zones_1, masterAddresses_1) {
    return __awaiter(this, arguments, void 0, function (instanceId, sshUser, region, zones, masterAddresses, replicationFactor, scriptUrl) {
        var ssmClient, masterAddressesString, command, response;
        if (replicationFactor === void 0) { replicationFactor = 3; }
        if (scriptUrl === void 0) { scriptUrl = "https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/modify_placement.sh"; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ssmClient = new client_ssm_1.SSMClient({ region: region });
                    masterAddressesString = masterAddresses.join(",");
                    command = "\n    # Download replica policy script\n    cd /home/".concat(sshUser, "\n    curl -o set_replica_policy.sh ").concat(scriptUrl, "\n    chmod +x set_replica_policy.sh\n    \n    # Run the script\n    cd /home/").concat(sshUser, "/yugabyte-2024.2.2.2\n    sudo -u ").concat(sshUser, " /home/").concat(sshUser, "/set_replica_policy.sh ").concat(region, " ").concat(zones, " ").concat(replicationFactor, " '").concat(masterAddressesString, "'\n  ");
                    return [4 /*yield*/, ssmClient.send(new client_ssm_1.SendCommandCommand({
                            DocumentName: "AWS-RunShellScript",
                            InstanceIds: [instanceId],
                            Parameters: {
                                commands: [command],
                            },
                        }))];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response];
            }
        });
    });
}
/**
 * Retrieves an AMI ID from AWS Systems Manager Parameter Store.
 *
 * @param {string} parameterName - The name of the SSM parameter containing the AMI ID
 * @returns {Promise<string>} The AMI ID stored in the parameter, or empty string if not found
 */
function getAmiIdFromSSM(parameterName) {
    return __awaiter(this, void 0, void 0, function () {
        var client, command, response;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    client = new client_ssm_1.SSMClient({ region: "us-east-1" });
                    command = new client_ssm_1.GetParameterCommand({
                        Name: parameterName,
                        WithDecryption: false,
                    });
                    return [4 /*yield*/, client.send(command)];
                case 1:
                    response = _b.sent();
                    return [2 /*return*/, ((_a = response.Parameter) === null || _a === void 0 ? void 0 : _a.Value) || ""];
            }
        });
    });
}
/**
 * Gets available Availability Zones for a specific region.
 *
 * @param {string} region - AWS region to query
 * @returns {Promise<string[]>} Array of available AZ names
 */
function getAvailableAZs(region) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, command, response, azNames, error_7;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    command = new client_ec2_1.DescribeAvailabilityZonesCommand({
                        Filters: [
                            {
                                Name: "region-name",
                                Values: [region],
                            },
                            {
                                Name: "state",
                                Values: ["available"],
                            },
                        ],
                    });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, ec2Client.send(command)];
                case 2:
                    response = _b.sent();
                    azNames = ((_a = response.AvailabilityZones) === null || _a === void 0 ? void 0 : _a.map(function (az) { return az.ZoneName || ""; })) || [];
                    // Filter out any empty strings
                    return [2 /*return*/, azNames.filter(function (name) { return name !== ""; })];
                case 3:
                    error_7 = _b.sent();
                    console.error("Error fetching availability zones for region ".concat(region, ":"), error_7);
                    throw error_7;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Builds a network configuration mapping CIDR blocks to Availability Zones.
 *
 * Creates a mapping where each CIDR block is associated with an Availability Zone,
 * distributing the specified number of subnets across available AZs in a round-robin fashion.
 * Each subnet uses a /24 CIDR block in the 10.0.x.0/24 range, incrementing for each node.
 *
 * @param {string} region - AWS region where the network will be deployed
 * @param {number} numberOfNodes - Number of subnets/nodes to create
 * @returns {Promise<{[cidr: string]: string}>} Object mapping CIDR blocks to Availability Zones
 * @throws {Error} If no Availability Zones are available for the specified region
 */
function buildNetworkConfig(region, numberOfNodes) {
    return __awaiter(this, void 0, void 0, function () {
        var availableAZs, cidrToAZ, i, cidr, azIndex, az;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getAvailableAZs(region)];
                case 1:
                    availableAZs = _a.sent();
                    if (availableAZs.length === 0) {
                        throw new Error("No availability zones found for region: ".concat(region));
                    }
                    cidrToAZ = {};
                    for (i = 0; i < numberOfNodes; i++) {
                        cidr = "10.0.".concat(i, ".0/24");
                        azIndex = i % availableAZs.length;
                        az = availableAZs[azIndex];
                        cidrToAZ[cidr] = az;
                    }
                    return [2 /*return*/, cidrToAZ];
            }
        });
    });
}
/**
 * Creates an EC2 key pair and saves the private key to a .pem file.
 *
 * @param {string} keyName - The name of the key pair to create.
 * @param {region} region - name of the region for the ec2 client
 * @returns {Promise<"success" | "fail">} - Returns "success" if the key was created and saved, otherwise "fail".
 *
 */
function createAndSaveKeyPair(keyName, region) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, key, filePath, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Creating key pair of name ".concat(keyName, " ..."));
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, ec2Client.send(new client_ec2_1.CreateKeyPairCommand({ KeyName: keyName }))];
                case 2:
                    key = _a.sent();
                    if (!key.KeyMaterial) {
                        throw new Error("No KeyMaterial returned");
                    }
                    filePath = (0, path_1.resolve)("".concat(keyName, ".pem"));
                    (0, fs_1.writeFileSync)(filePath, key.KeyMaterial, { mode: 256 });
                    console.log("Private key saved to: ".concat(filePath));
                    return [2 /*return*/, "success"];
                case 3:
                    err_4 = _a.sent();
                    console.error("Error creating key pair:", err_4);
                    return [2 /*return*/, "fail"];
                case 4: return [2 /*return*/];
            }
        });
    });
}
