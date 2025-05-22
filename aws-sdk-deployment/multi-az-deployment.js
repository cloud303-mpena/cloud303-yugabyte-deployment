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
        var params, vpcId, cidrToAZ, subnetIds, intIdAndRouteTableId, associationResponse, securityGroupId, netIntIds, elasticIps, _i, subnetIds_1, subnetId, currNetIntIdAndIp, instanceProfileArn, azs, ec2InstanceInfo, masterPrivateIpAddresses, i, instances, response, _a, _b, err_1, firstInstance;
        var _this = this;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, resGen.promptForParams()];
                case 1:
                    params = _c.sent();
                    return [4 /*yield*/, resGen.createVpc(params.Region, "10.0.0.0/16")];
                case 2:
                    vpcId = _c.sent();
                    return [4 /*yield*/, resGen.buildNetworkConfig(params.Region, params.NumberOfNodes)];
                case 3:
                    cidrToAZ = _c.sent();
                    return [4 /*yield*/, resGen.createSubnets(vpcId, params.Region, cidrToAZ)];
                case 4:
                    subnetIds = _c.sent();
                    return [4 /*yield*/, resGen.createInternetGatewayAndRouteTable(vpcId, params.Region)];
                case 5:
                    intIdAndRouteTableId = _c.sent();
                    return [4 /*yield*/, resGen.createSubnetRouteTableAssociations(subnetIds, intIdAndRouteTableId.routeTableId, params.Region)];
                case 6:
                    associationResponse = _c.sent();
                    return [4 /*yield*/, resGen.createYugaByteSecurityGroup(vpcId, "10.0.0.0/16", params.Region)];
                case 7:
                    securityGroupId = _c.sent();
                    netIntIds = [];
                    elasticIps = [];
                    _i = 0, subnetIds_1 = subnetIds;
                    _c.label = 8;
                case 8:
                    if (!(_i < subnetIds_1.length)) return [3 /*break*/, 11];
                    subnetId = subnetIds_1[_i];
                    return [4 /*yield*/, resGen.createNetworkInterfaceWithPublicIP(subnetId, securityGroupId, params.Region)];
                case 9:
                    currNetIntIdAndIp = _c.sent();
                    netIntIds.push(currNetIntIdAndIp.networkInterfaceId);
                    elasticIps.push(currNetIntIdAndIp.publicIp);
                    _c.label = 10;
                case 10:
                    _i++;
                    return [3 /*break*/, 8];
                case 11: return [4 /*yield*/, resGen.createSSMInstanceRole("SSMPermissionRole")];
                case 12:
                    instanceProfileArn = _c.sent();
                    azs = Object.values(cidrToAZ);
                    ec2InstanceInfo = [];
                    masterPrivateIpAddresses = [];
                    for (i = 0; i < params.RFFactor; i++) {
                        ec2InstanceInfo.push(resGen.createEC2Instance("yugabyte-".concat(i), params.Region, params.InstanceType, params.LatestAmiId, params.KeyName, netIntIds[i], i < params.RFFactor ? true : false, netIntIds, azs[i], params.SshUser));
                    }
                    return [4 /*yield*/, Promise.all(ec2InstanceInfo.map(function (instancePromise) { return __awaiter(_this, void 0, void 0, function () {
                            var instance;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, instancePromise];
                                    case 1:
                                        instance = _a.sent();
                                        return [2 /*return*/, resGen.waitForInstanceRunning(params.Region, instance.instanceId)];
                                }
                            });
                        }); }))];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, Promise.all(ec2InstanceInfo)];
                case 14:
                    instances = _c.sent();
                    instances.forEach(function (_a) {
                        var instanceId = _a.instanceId;
                        resGen.associateInstanceProfileWithEc2(instanceId, instanceProfileArn, params.Region);
                    });
                    instances.forEach(function (_a) {
                        var privateIpAddress = _a.privateIpAddress, isMasterNode = _a.isMasterNode;
                        if (isMasterNode) {
                            masterPrivateIpAddresses.push(privateIpAddress);
                        }
                        else {
                        }
                    });
                    _c.label = 15;
                case 15:
                    if (!true) return [3 /*break*/, 22];
                    _c.label = 16;
                case 16:
                    _c.trys.push([16, 19, , 21]);
                    _b = (_a = resGen).configureYugabyteNodes;
                    return [4 /*yield*/, ec2InstanceInfo[0]];
                case 17: return [4 /*yield*/, _b.apply(_a, [(_c.sent()).instanceId,
                        params.SshUser,
                        params.Region,
                        Object.values(cidrToAZ),
                        masterPrivateIpAddresses,
                        params.RFFactor])];
                case 18:
                    response = _c.sent();
                    return [3 /*break*/, 22];
                case 19:
                    err_1 = _c.sent();
                    console.log("Error, trying again: " + err_1);
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 5000); })];
                case 20:
                    _c.sent();
                    return [3 /*break*/, 21];
                case 21: return [3 /*break*/, 15];
                case 22: return [4 /*yield*/, ec2InstanceInfo[0]];
                case 23:
                    firstInstance = _c.sent();
                    console.log("View YB UI at: http://".concat(firstInstance.publicIp, ":7000"));
                    return [2 /*return*/, ""];
            }
        });
    });
}
deployMultiAZ();
