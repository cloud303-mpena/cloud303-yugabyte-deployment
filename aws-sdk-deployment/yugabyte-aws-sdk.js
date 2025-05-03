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
var client_ec2_1 = require("@aws-sdk/client-ec2");
var inquirer_1 = require("inquirer");
var REGION = "us-east-1";
var ec2Client = new client_ec2_1.EC2Client({ region: REGION });
var DEFAULTS = {
    DBVersion: "2024.2.2.1-b190",
    RFFactor: "3",
    KeyName: "",
    InstanceType: "t3.medium",
    LatestAmiId: "/aws/service/canonical/ubuntu/server/jammy/stable/current/amd64/hvm/ebs-gp2/ami-id",
    SshUser: "ubuntu",
    DeploymentType: "Multi-AZ"
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
                            type: 'input',
                            name: 'DBVersion',
                            message: "DBVersion",
                            default: DEFAULTS.DBVersion
                        },
                        {
                            type: 'input',
                            name: 'RFFactor',
                            message: "RFFactor",
                            default: DEFAULTS.RFFactor
                        },
                        {
                            type: 'input',
                            name: 'KeyName',
                            message: 'KeyName (required)',
                            validate: function (input) { return input ? true : 'KeyName is required.'; }
                        },
                        {
                            type: 'list',
                            name: 'InstanceType',
                            message: 'Select Instance Type',
                            choices: INSTANCE_TYPES,
                            default: DEFAULTS.InstanceType
                        },
                        {
                            type: 'input',
                            name: 'LatestAmiId',
                            message: 'LatestAmiId',
                            default: DEFAULTS.LatestAmiId
                        },
                        {
                            type: 'input',
                            name: 'SshUser',
                            message: 'SshUser',
                            default: DEFAULTS.SshUser
                        },
                        {
                            type: 'list',
                            name: 'DeploymentType',
                            message: 'Select Deployment Type',
                            choices: DEPLOYMENT_TYPES,
                            default: DEFAULTS.DeploymentType
                        },
                    ])];
                case 1:
                    answers = _a.sent();
                    return [2 /*return*/, answers];
            }
        });
    });
}
// Example usage
promptForParams().then(function (params) {
    console.log("Collected parameters:", params);
}).catch(function (err) {
    console.error(err.message);
});
function createEC2Instance(instanceType, imageId, keyName, securityGroup) {
    return __awaiter(this, void 0, void 0, function () {
        var instanceParams, command, data, instance, instanceId, err_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    instanceParams = {
                        ImageId: "/aws/service/canonical/ubuntu/server/jammy/stable/current/amd64/hvm/ebs-gp2/ami-id",
                        InstanceType: instanceType,
                        MinCount: 1,
                        MaxCount: 1,
                        KeyName: keyName,
                        SecurityGroupIds: [securityGroup],
                    };
                    command = new client_ec2_1.RunInstancesCommand(instanceParams);
                    return [4 /*yield*/, ec2Client.send(command)];
                case 1:
                    data = _b.sent();
                    instance = (_a = data.Instances) === null || _a === void 0 ? void 0 : _a[0];
                    instanceId = instance === null || instance === void 0 ? void 0 : instance.InstanceId;
                    console.log("Successfully created EC2 instance with ID: ".concat(instanceId));
                    if (!instanceId) {
                        throw new Error("Instance ID is undefined.");
                    }
                    return [2 /*return*/, instanceId];
                case 2:
                    err_1 = _b.sent();
                    console.error("Error creating EC2 instance:", err_1);
                    throw err_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function waitForInstanceRunning(instanceId) {
    return __awaiter(this, void 0, void 0, function () {
        var instanceRunning, describeParams, command, data, state, publicIp, err_2;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    console.log("Waiting for instance ".concat(instanceId, " to be in 'running' state..."));
                    instanceRunning = false;
                    _f.label = 1;
                case 1:
                    if (!!instanceRunning) return [3 /*break*/, 9];
                    _f.label = 2;
                case 2:
                    _f.trys.push([2, 7, , 8]);
                    describeParams = {
                        InstanceIds: [instanceId]
                    };
                    command = new client_ec2_1.DescribeInstancesCommand(describeParams);
                    return [4 /*yield*/, ec2Client.send(command)];
                case 3:
                    data = _f.sent();
                    state = (_c = (_b = (_a = data.Reservations) === null || _a === void 0 ? void 0 : _a[0].Instances) === null || _b === void 0 ? void 0 : _b[0].State) === null || _c === void 0 ? void 0 : _c.Name;
                    if (!state) {
                        throw new Error("State is undefined");
                    }
                    console.log("Current instance state: ".concat(state));
                    if (!(state === "running")) return [3 /*break*/, 4];
                    instanceRunning = true;
                    console.log("Instance ".concat(instanceId, " is now running!"));
                    publicIp = (_e = (_d = data.Reservations) === null || _d === void 0 ? void 0 : _d[0].Instances) === null || _e === void 0 ? void 0 : _e[0].PublicIpAddress;
                    if (!publicIp) {
                        throw new Error("public ip undefined");
                    }
                    if (publicIp) {
                        console.log("Public IP address: ".concat(publicIp));
                    }
                    return [3 /*break*/, 6];
                case 4: 
                // Wait for 5 seconds before checking again
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 5000); })];
                case 5:
                    // Wait for 5 seconds before checking again
                    _f.sent();
                    _f.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    err_2 = _f.sent();
                    console.error("Error checking instance state:", err_2);
                    throw err_2;
                case 8: return [3 /*break*/, 1];
                case 9: return [2 /*return*/];
            }
        });
    });
}
