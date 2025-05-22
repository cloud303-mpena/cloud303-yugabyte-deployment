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
var resGen = require("./resource-generator");
function deployMultiAZ() {
    return __awaiter(this, void 0, void 0, function () {
        var params, vpcId, azToCidr, subnetIds, intIdAndRouteTableId, associationResponse, securityGroupId, netIntIds, elasticIps, _i, subnetIds_1, subnetId, currNetIntIdAndIp, rolename, azs, ec2InstanceInfo, masterPrivateIpAddresses, i, instances, firstInstance;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, resGen.promptForParams()];
                case 1:
                    params = _a.sent();
                    return [4 /*yield*/, resGen.createVpc("10.0.0.0/16", "Yugabyte VPC")];
                case 2:
                    vpcId = _a.sent();
                    azToCidr = {};
                    //if (params.RFFactor === 3) {
                    azToCidr = {
                        "us-east-1a": "10.0.0.0/24",
                        "us-east-1b": "10.0.1.0/24",
                        "us-east-1c": "10.0.2.0/24",
                    };
                    return [4 /*yield*/, resGen.createSubnets(vpcId, azToCidr)];
                case 3:
                    subnetIds = _a.sent();
                    return [4 /*yield*/, resGen.createInternetGatewayAndRouteTable(vpcId)];
                case 4:
                    intIdAndRouteTableId = _a.sent();
                    return [4 /*yield*/, resGen.createSubnetRouteTableAssociations(subnetIds, intIdAndRouteTableId.routeTableId)];
                case 5:
                    associationResponse = _a.sent();
                    return [4 /*yield*/, resGen.createYugaByteSecurityGroup(vpcId, "10.0.0.0/16")];
                case 6:
                    securityGroupId = _a.sent();
                    netIntIds = [];
                    elasticIps = [];
                    _i = 0, subnetIds_1 = subnetIds;
                    _a.label = 7;
                case 7:
                    if (!(_i < subnetIds_1.length)) return [3 /*break*/, 10];
                    subnetId = subnetIds_1[_i];
                    return [4 /*yield*/, resGen.createNetworkInterfaceWithPublicIP(subnetId, securityGroupId)];
                case 8:
                    currNetIntIdAndIp = _a.sent();
                    netIntIds.push(currNetIntIdAndIp.networkInterfaceId); // This is correct!
                    elasticIps.push(currNetIntIdAndIp.publicIp);
                    _a.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 7];
                case 10: return [4 /*yield*/, resGen.createSSMInstanceRole("SSMPermissionRole")];
                case 11:
                    rolename = _a.sent();
                    azs = Object.keys(azToCidr);
                    ec2InstanceInfo = [];
                    masterPrivateIpAddresses = [];
                    for (i = 0; i < params.RFFactor; i++) {
                        ec2InstanceInfo.push(resGen.createEC2Instance("yugabyte-".concat(i), "us-east-1", params.InstanceType, params.LatestAmiId, params.KeyName, securityGroupId, netIntIds[i], vpcId, true, netIntIds, azs[i]));
                    }
                    return [4 /*yield*/, Promise.all(ec2InstanceInfo.map(function (instancePromise) { return __awaiter(_this, void 0, void 0, function () {
                            var instance;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, instancePromise];
                                    case 1:
                                        instance = _a.sent();
                                        return [2 /*return*/, resGen.waitForInstanceRunning("us-east-1", instance.instanceId)];
                                }
                            });
                        }); }))];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, Promise.all(ec2InstanceInfo)];
                case 13:
                    instances = _a.sent();
                    instances.forEach(function (_a) {
                        var privateIpAddress = _a.privateIpAddress, isMasterNode = _a.isMasterNode;
                        if (isMasterNode) {
                            masterPrivateIpAddresses.push(privateIpAddress);
                        }
                        else {
                        }
                    });
                    // const response = await resGen.configureYugabyteNodes(
                    //   (
                    //     await ec2InstanceInfo[0]
                    //   ).instanceId,
                    //   params.SshUser,
                    //   "us-east-1",
                    //   Object.keys(azToCidr),
                    //   masterPrivateIpAddresses,
                    //   params.RFFactor
                    // );
                    console.log("Not running, trying again");
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10000); })];
                case 14:
                    _a.sent();
                    return [4 /*yield*/, ec2InstanceInfo[0]];
                case 15:
                    firstInstance = _a.sent();
                    console.log("View YB UI at: http://".concat(firstInstance.publicIp, ":7000"));
                    return [2 /*return*/, ""];
            }
        });
    });
}
deployMultiAZ();
//nest.js
