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
exports.createSSMInstanceRole = createSSMInstanceRole;
exports.promptForParams = promptForParams;
exports.createEC2Instance = createEC2Instance;
exports.getPrimaryPrivateIpAddress = getPrimaryPrivateIpAddress;
exports.waitForInstanceRunning = waitForInstanceRunning;
exports.createVpc = createVpc;
exports.createSubnets = createSubnets;
exports.createYugaByteSecurityGroup = createYugaByteSecurityGroup;
exports.createInternetGatewayAndRouteTable = createInternetGatewayAndRouteTable;
exports.createSubnetRouteTableAssociations = createSubnetRouteTableAssociations;
exports.createNetworkInterfaceWithPublicIP = createNetworkInterfaceWithPublicIP;
exports.configureYugabyteNodes = configureYugabyteNodes;
var client_ec2_1 = require("@aws-sdk/client-ec2");
var client_ssm_1 = require("@aws-sdk/client-ssm");
var inquirer_1 = require("inquirer");
var client_iam_1 = require("@aws-sdk/client-iam");
function createSSMInstanceRole(roleName) {
    return __awaiter(this, void 0, void 0, function () {
        var iamClient, assumeRolePolicyDocument;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    iamClient = new client_iam_1.IAMClient({ region: "us-east-1" });
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
                    // 1. Create IAM Role
                    return [4 /*yield*/, iamClient.send(new client_iam_1.CreateRoleCommand({
                            RoleName: roleName,
                            AssumeRolePolicyDocument: assumeRolePolicyDocument,
                        }))];
                case 1:
                    // 1. Create IAM Role
                    _a.sent();
                    // 2. Attach AmazonSSMManagedInstanceCore Policy
                    return [4 /*yield*/, iamClient.send(new client_iam_1.AttachRolePolicyCommand({
                            RoleName: roleName,
                            PolicyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
                        }))];
                case 2:
                    // 2. Attach AmazonSSMManagedInstanceCore Policy
                    _a.sent();
                    // 3. Create Instance Profile (required for EC2 attachment)
                    return [4 /*yield*/, iamClient.send(new client_iam_1.CreateInstanceProfileCommand({
                            InstanceProfileName: roleName,
                        }))];
                case 3:
                    // 3. Create Instance Profile (required for EC2 attachment)
                    _a.sent();
                    // 4. Add Role to Instance Profile
                    return [4 /*yield*/, iamClient.send(new client_iam_1.AddRoleToInstanceProfileCommand({
                            InstanceProfileName: roleName,
                            RoleName: roleName,
                        }))];
                case 4:
                    // 4. Add Role to Instance Profile
                    _a.sent();
                    console.log("Created EC2 IAM role and instance profile: ".concat(roleName));
                    return [2 /*return*/, roleName];
            }
        });
    });
}
var DEFAULTS = {
    DBVersion: "2024.2.2.1-b190",
    RFFactor: 3,
    KeyName: "",
    InstanceType: "t3.medium",
    LatestAmiId: "/aws/service/canonical/ubuntu/server/jammy/stable/current/amd64/hvm/ebs-gp2/ami-id",
    SshUser: "ubuntu",
    DeploymentType: "Multi-AZ",
    Region: "us-east-1"
};
var INSTANCE_TYPES = ["t3.medium", "c5.xlarge", "c5.2xlarge"];
var DEPLOYMENT_TYPES = ["Multi-AZ", "Single-Server", "Multi-Region"];
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
                            name: "RFFactor",
                            message: "RFFactor",
                            default: String(DEFAULTS.RFFactor),
                        },
                        {
                            type: "input",
                            name: "KeyName",
                            message: "KeyName (required)",
                            default: "Key",
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
 * Creates an EC2 instance in the network interface it is passed.
 * Sets up user data to install necessary libraries, start necessary tools, and initialize tserver and master server
 *
 */
function createEC2Instance(name_1, region_1, instanceType_1, imageId_1, keyName_1, securityGroup_1, netIntId_1, vpcId_1) {
    return __awaiter(this, arguments, void 0, function (name, region, instanceType, imageId, keyName, securityGroup, netIntId, vpcId, isMasterNode, masterNetIntIds, zone, sshUser) {
        var ec2Client, blockDeviceMappings, nodePrivateIp, masterPrivateIps, iamInstanceProfileSpec, instanceParams, command, data, instance, instanceId, privateIpAddress, err_1;
        var _a;
        var _b;
        if (isMasterNode === void 0) { isMasterNode = false; }
        if (masterNetIntIds === void 0) { masterNetIntIds = []; }
        if (sshUser === void 0) { sshUser = "ubuntu"; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: region });
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 6, , 7]);
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
                    return [4 /*yield*/, getPrimaryPrivateIpAddress(netIntId)];
                case 2:
                    nodePrivateIp = _c.sent();
                    return [4 /*yield*/, Promise.all(masterNetIntIds.map(function (id) { return getPrimaryPrivateIpAddress(id); }))];
                case 3:
                    masterPrivateIps = _c.sent();
                    iamInstanceProfileSpec = {
                        Name: name
                    };
                    _a = {};
                    return [4 /*yield*/, getAmiIdFromSSM(imageId)];
                case 4:
                    instanceParams = (_a.ImageId = _c.sent(),
                        _a.InstanceType = instanceType,
                        _a.IamInstanceProfile = iamInstanceProfileSpec,
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
                    if (!instanceId) {
                        throw new Error("Instance ID is undefined.");
                    }
                    return [2 /*return*/, {
                            instanceId: instanceId,
                            privateIpAddress: privateIpAddress,
                            isMasterNode: isMasterNode,
                        }];
                case 6:
                    err_1 = _c.sent();
                    console.error("Error creating EC2 instance:", err_1);
                    throw err_1;
                case 7: return [2 /*return*/];
            }
        });
    });
}
function getPrimaryPrivateIpAddress(networkInterfaceId) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, response, primaryPrivateIpAddress, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({});
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
                    console.log("Primary private IP address for ".concat(networkInterfaceId, ": ").concat(primaryPrivateIpAddress));
                    return [2 /*return*/, primaryPrivateIpAddress];
                case 3:
                    error_1 = _a.sent();
                    console.error("Error getting primary private IP address for network interface ".concat(networkInterfaceId, ":"), error_1);
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Helper function to generate the user data script for the EC2 instance
function generateUserData(isMasterNode, masterPrivateIps, zone, region, sshUser, nodePrivateIp) {
    // Format master addresses for YugaByteDB configuration
    var masterAddresses = masterPrivateIps.map(function (ip) { return "".concat(ip, ":7100"); }).join(",");
    return "#!/bin/bash -xe\napt-get update -y\napt-get install -y python3-pip\n\n# Install required software\ncd /home/".concat(sshUser, "\nwget https://software.yugabyte.com/releases/2024.2.2.2/yugabyte-2024.2.2.2-b2-linux-x86_64.tar.gz\ntar xvfz yugabyte-2024.2.2.2-b2-linux-x86_64.tar.gz\ncd yugabyte-2024.2.2.2/\n./bin/post_install.sh\n\n# Download configuration scripts\ncd /home/").concat(sshUser, "\ncurl -o install_software.sh https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/install_software.sh\ncurl -o start_master.sh https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/start_master.sh\ncurl -o start_tserver.sh https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/start_tserver.sh\ncurl -o set_replica_policy.sh https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/set_replica_policy.sh\nchmod +x *.sh\nbash install_software.sh\n\n# Run the appropriate node setup script based on node type\ncd /home/").concat(sshUser, "/yugabyte-2024.2.2.2\n").concat(isMasterNode
        ? "sudo -u ".concat(sshUser, " /home/").concat(sshUser, "/start_master.sh ").concat(nodePrivateIp, " ").concat(zone, " ").concat(region, " /home/").concat(sshUser, " '").concat(masterAddresses, "'")
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
function createVpc(cidrBlock, name) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, createVpcCommand, vpcResult, vpcId, err_3;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: "us-east-1" });
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
function createSubnets(vpcId, azToCidr // e.g., { "us-east-1a": "10.0.0.0/24", "us-east-1b": "10.0.1.0/24" }
) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, subnetIds, _i, _a, _b, az, cidr, subnetCommand, result, subnetId;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({ region: "us-east-1" });
                    subnetIds = [];
                    console.log("Creating subnets...");
                    _i = 0, _a = Object.entries(azToCidr);
                    _d.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    _b = _a[_i], az = _b[0], cidr = _b[1];
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
                        console.log("Created subnet ".concat(subnetId, " in ").concat(az));
                    }
                    else {
                        console.warn("Failed to create subnet in ".concat(az));
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
function createYugaByteSecurityGroup(vpcId, vpcCidr) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, createSgParams, createSgResponse, securityGroupId, ingressRules, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({});
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
                    error_2 = _a.sent();
                    console.error("Error creating YugaByte security group:", error_2);
                    throw error_2;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Creates an Internet Gateway, attaches it to a VPC, and creates a public route table
 * @param vpcId - The ID of the VPC to attach the Internet Gateway to
 * @returns Promise resolving to the created resources' IDs
 */
function createInternetGatewayAndRouteTable(vpcId) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, createIgwResponse, internetGatewayId, createRouteTableResponse, routeTableId, error_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({});
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
                    error_3 = _c.sent();
                    console.error("Error creating Internet Gateway and Route Table:", error_3);
                    throw error_3;
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Associates a subnet with a route table
 * @param subnetId - The ID of the subnet to associate
 * @param routeTableId - The ID of the route table to associate with the subnet
 * @returns Promise resolving to the association response
 */
function createSubnetRouteTableAssociations(subnetIds, routeTableId) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, associationResponses, _i, subnetIds_1, subnetId, associationResponse, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({});
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
                    error_4 = _a.sent();
                    console.error("Error associating subnets with route table ".concat(routeTableId, ":"), error_4);
                    throw error_4;
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
 * @returns A promise resolving to an object containing the network interface ID and public IP address
 */
function createNetworkInterfaceWithPublicIP(subnetId, securityGroupId) {
    return __awaiter(this, void 0, void 0, function () {
        var ec2Client, createResponse, networkInterfaceId, allocateResponse, allocationId, publicIp, privateIp, error_5;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    ec2Client = new client_ec2_1.EC2Client({});
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
                    error_5 = _c.sent();
                    console.error("Error creating network interface with public IP:", error_5);
                    throw error_5;
                case 6: return [2 /*return*/];
            }
        });
    });
}
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
