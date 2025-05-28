import * as resGen from "./resource-generator";
import { YugabyteParams } from "./types";

async function deployMultiAZ(): Promise<string> {
  //Prompts user for paramaters
  const params: YugabyteParams = await resGen.promptForYBParams();

  // Create Tag from params
  const managedTag = {
    Key: params.ManagementTagKey,
    Value: params.ManagementTagValue,
  };

  //Creates key pair if it doesn't already exist
  await resGen.createAndSaveKeyPair(params.KeyName, params.Region);

  const vpcId = await resGen.createVpc(params.Region, "10.0.0.0/16");

  const cidrToAZ = await resGen.buildNetworkConfig(
    params.Region,
    params.NumberOfNodes
  );
  const subnetIds = await resGen.createSubnets(vpcId!, params.Region, cidrToAZ);

  const intIdAndRouteTableId = await resGen.createInternetGatewayAndRouteTable(
    vpcId!,
    params.Region
  );

  const associationResponse = await resGen.createSubnetRouteTableAssociations(
    subnetIds,
    intIdAndRouteTableId.routeTableId,
    params.Region
  );

  const securityGroupId = await resGen.createYugaByteSecurityGroup(
    vpcId!,
    "10.0.0.0/16",
    params.Region
  );

  let netIntIds: string[] = [];
  let elasticIps: string[] = [];
  for (const subnetId of subnetIds) {
    let currNetIntIdAndIp = await resGen.createNetworkInterfaceWithPublicIP(
      subnetId,
      securityGroupId,
      params.Region
    );
    netIntIds.push(currNetIntIdAndIp.networkInterfaceId);
    elasticIps.push(currNetIntIdAndIp.publicIp);
  }

  const instanceProfileArn = await resGen.createSSMInstanceRole(
    "SSMPermissionRole",
    managedTag
  );

  const azs = Object.values(cidrToAZ);

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
        params.Region,
        params.InstanceType,
        params.LatestAmiId,
        params.KeyName,
        netIntIds[i],
        i < params.RFFactor ? true : false,
        netIntIds,
        azs[i],
        params.SshUser
      )
    );
  }

  await Promise.all(
    ec2InstanceInfo.map(async (instancePromise) => {
      const instance = await instancePromise;
      return resGen.waitForInstanceRunning(params.Region, instance.instanceId);
    })
  );

  const instances = await Promise.all(ec2InstanceInfo);
  instances.forEach(({ instanceId }) => {
    resGen.associateInstanceProfileWithEc2(
      instanceId,
      instanceProfileArn,
      params.Region
    );
  });

  instances.forEach(({ privateIpAddress, isMasterNode }) => {
    if (isMasterNode) {
      masterPrivateIpAddresses.push(privateIpAddress!);
    } else {
    }
  });

  let numTries = 0;
  while (numTries < 30) {
    try {
      const response = await resGen.configureYugabyteNodes(
        (
          await ec2InstanceInfo[0]
        ).instanceId,
        params.SshUser,
        params.Region,
        Object.values(cidrToAZ),
        masterPrivateIpAddresses,
        params.RFFactor
      );
      break;
    } catch (err) {
      numTries++;
      console.log("Waiting for instance to be in valid state... " + err);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  if (numTries >= 30) {
    console.log("Instances timed out");
  }
  const firstInstance = await ec2InstanceInfo[0];
  console.log(`View YB UI at: http://${firstInstance.publicIp}:7000`);
  return "";
}

deployMultiAZ();
