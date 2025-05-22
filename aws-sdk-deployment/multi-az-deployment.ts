import { InstanceIpv6Address } from "@aws-sdk/client-ec2";
import * as resGen from "./resource-generator";
import { YugabyteParams } from "./types";
import { waitForDebugger } from "inspector";

async function deployMultiAZ(): Promise<string> {
  const params: YugabyteParams = await resGen.promptForParams();

  const vpcId = await resGen.createVpc("10.0.0.0/16", "Yugabyte VPC");

  //TODO: CHANGE THIS TO DO BY REGION LATER
  let azToCidr: { [az: string]: string } = {};
  //if (params.RFFactor === 3) {
  azToCidr = {
    "us-east-1a": "10.0.0.0/24",
    "us-east-1b": "10.0.1.0/24",
    "us-east-1c": "10.0.2.0/24",
  };
  //   } else if (params.RFFactor === 5) {
  //     azToCidr = {
  //       "us-east-1a": "10.0.0.0/24",
  //       "us-east-1b": "10.0.1.0/24",
  //       "us-east-1c": "10.0.2.0/24",
  //       "us-east-1d": "10.0.3.0/24",
  //       "us-east-1e": "10.0.4.0/24"
  //     };
  //   }
  const subnetIds = await resGen.createSubnets(vpcId!, azToCidr);

  const intIdAndRouteTableId = await resGen.createInternetGatewayAndRouteTable(
    vpcId!
  );

  const associationResponse = await resGen.createSubnetRouteTableAssociations(
    subnetIds,
    intIdAndRouteTableId.routeTableId
  );

  const securityGroupId = await resGen.createYugaByteSecurityGroup(
    vpcId!,
    "10.0.0.0/16"
  );

  let netIntIds: string[] = [];
  let elasticIps: string[] = [];
  for (const subnetId of subnetIds) {
    let currNetIntIdAndIp = await resGen.createNetworkInterfaceWithPublicIP(
      subnetId,
      securityGroupId
    );
    netIntIds.push(currNetIntIdAndIp.networkInterfaceId); // This is correct!
    elasticIps.push(currNetIntIdAndIp.publicIp);
  }
  //TODO: make sure it doesnt exist
  const instanceProfileArn = await resGen.createSSMInstanceRole("SSMPermissionRole")

  const azs = Object.keys(azToCidr);

  let ec2InstanceInfo: Promise<{
    instanceId: string;
    privateIpAddress?: string;
    publicIp?: string;
    isMasterNode: boolean;
  }>[] = [];
  let masterPrivateIpAddresses: string[] = [];

  for (let i = 0; i < params.RFFactor; i++) {
    ec2InstanceInfo.push(
      resGen.createEC2Instance(
        `yugabyte-${i}`,
        "us-east-1",
        params.InstanceType,
        params.LatestAmiId,
        params.KeyName,
        securityGroupId,
        netIntIds[i],
        vpcId!,
        instanceProfileArn,
        true,
        netIntIds,
        azs[i]
      )
    );
  }

  await Promise.all(
    ec2InstanceInfo.map(async (instancePromise) => {
      const instance = await instancePromise;
      return resGen.waitForInstanceRunning("us-east-1", instance.instanceId);
    })
  );

  const instances = await Promise.all(ec2InstanceInfo);
  instances.forEach(({ instanceId}) => {
    resGen.associateInstanceProfileWithEc2(instanceId, instanceProfileArn)
  });

  instances.forEach(({ privateIpAddress, isMasterNode }) => {
    if (isMasterNode) {
      masterPrivateIpAddresses.push(privateIpAddress!);
    } else {
    }
  });

  const response = await resGen.configureYugabyteNodes(
    (
      await ec2InstanceInfo[0]
    ).instanceId,
    params.SshUser,
    "us-east-1",
    Object.keys(azToCidr),
    masterPrivateIpAddresses,
    params.RFFactor
  );

  console.log("Not running, trying again");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  const firstInstance = await ec2InstanceInfo[0];
  console.log(`View YB UI at: http://${firstInstance.publicIp}:7000`);
  return "";
}

deployMultiAZ();

//nest.js
