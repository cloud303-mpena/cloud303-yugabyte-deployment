import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import inquirer from "inquirer";
import * as resGen from "./resource-generator";
import { YugabyteParams, PlacementInfo } from "./types";

const INSTANCE_TYPES = ["t3.medium", "c5.xlarge", "c5.2xlarge"];
const PLACEMENTDEFAULTS = {
  NumRegions: 2,
  DefaultRegions: ["us-east-1", "us-west-2"],
};

async function promptForYBParams() {
  const DEFAULTS: YugabyteParams = {
    DBVersion: "2024.2.2.1-b190",
    RFFactor: 3,
    NumberOfNodes: 3,
    KeyName: "",
    InstanceType: "t3.medium",
    LatestAmiId:
      "/aws/service/canonical/ubuntu/server/jammy/stable/current/amd64/hvm/ebs-gp2/ami-id",
    SshUser: "ubuntu",
    DeploymentType: "Multi-AZ",
    ManagementTagKey: "c303-yugabyte-managed",
    ManagementTagValue: "true",
    Region: "us-east-1",
  };

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "DBVersion",
      message: `DBVersion`,
      default: DEFAULTS.DBVersion,
    },
    {
      type: "input",
      name: "NumberOfNodes",
      message: `Number of Nodes`,
      default: String(DEFAULTS.NumberOfNodes),
    },
    {
      type: "input",
      name: "RFFactor",
      message: `RFFactor`,
      default: String(DEFAULTS.RFFactor),
      //RF must be odd
      validate: (input) => parseInt(input, 10) % 2 == 1,
    },
    {
      type: "input",
      name: "KeyName",
      message: "KeyName",
      default: "YugabyteKey",
      validate: (input) => (input ? true : "KeyName is required."),
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
      type: "input",
      name: "ManagementTagKey",
      message: "ManagementTagKey",
      default: DEFAULTS.ManagementTagKey,
    },
    {
      type: "input",
      name: "ManagementTagValue",
      message: "ManagementTagValue",
      default: DEFAULTS.ManagementTagValue,
    },
  ]);

  return answers;
}

/**
 * Validates if a region exists in AWS
 * @param region Region name to validate
 * @returns True if valid, error message if invalid
 */
async function validateRegion(region: string): Promise<boolean | string> {
  try {
    const ec2Client = new EC2Client({ region: "us-east-1" });
    const command = new DescribeRegionsCommand({
      RegionNames: [region],
      AllRegions: false,
    });

    const response = await ec2Client.send(command);
    if (response.Regions && response.Regions.length > 0) {
      return true;
    } else {
      return `Region '${region}' does not exist in AWS`;
    }
  } catch (error) {
    return `Invalid region: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

async function promptForPlacementInfo(): Promise<PlacementInfo> {
  // Step 1: Ask for number of regions
  const numRegionsAnswer = await inquirer.prompt([
    {
      type: "input",
      name: "NumRegions",
      message: "Enter the number of regions:",
      default: String(PLACEMENTDEFAULTS.NumRegions),
      validate: (input) => {
        const num = parseInt(input, 10);
        return !isNaN(num) && num > 0
          ? true
          : "Please enter a valid positive number";
      },
    },
  ]);

  const numRegions = parseInt(numRegionsAnswer.NumRegions, 10);
  const regions: string[] = [];

  // Step 2: Collect and validate each region
  for (let i = 0; i < numRegions; i++) {
    const regionAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "region",
        message: `Enter region ${i + 1} name (e.g., us-west-2):`,
        default: PLACEMENTDEFAULTS.DefaultRegions[i] || "",
        validate: validateRegion,
      },
    ]);

    regions.push(regionAnswer.region);
  }

  // Step 3: Collect AZs for each region
  const azs: string[][] = [];

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    const availableAZs = await resGen.getAvailableAZs(region);

    if (availableAZs.length === 0) {
      throw new Error(
        `Could not retrieve availability zones for region ${region}`
      );
    }

    // Show available AZs for this region
    console.log(`\nAvailable AZs in ${region}:`, availableAZs.join(", "));

    const azSelectionAnswer = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedAZs",
        message: `Select availability zones for ${region}:`,
        choices: availableAZs,
        default: availableAZs.slice(0, Math.min(3, availableAZs.length)),
        validate: (input) =>
          input.length > 0 ? true : "Select at least one availability zone",
      },
    ]);

    azs.push(azSelectionAnswer.selectedAZs);
  }

  return {
    NumRegions: numRegions,
    Regions: regions,
    AZs: azs,
  };
}

async function deployResources(context: any, regionIdx: number): Promise<string> {
    const region = context.placementInfo.Regions[regionIdx];
    const regionAZs = context.placementInfo.AZs[regionIdx];
    const cidrBlock = context.regionToCidr[region];
    let instanceProfileArn: string;
    console.log(
      `\n--- Deploying infrastructure in ${region} (${cidrBlock}) ---`
    );

    const vpcId = await resGen.createVpc(region, cidrBlock);
    context.vpcIds.push(vpcId!);
    context.regionToVpcId[region] = vpcId!;

    // Build network config for this region
    // TODO: modify this to use the specific AZs selected
    const nodesPerRegion = Math.ceil(
      context.params.NumberOfNodes / context.placementInfo.NumRegions
    );

    // Create subnets based on chosen AZs
    const cidrToAZ: Record<string, string> = {};
    for (let azIdx = 0; azIdx < context.numNodesPerRegion[regionIdx]; azIdx++) {
      // Create subnet CIDR blocks within the region's VPC CIDR
      cidrToAZ[`10.${regionIdx}.${azIdx}.0/24`] =
        regionAZs[azIdx % regionAZs.length];
    }

    const subnetIds = await resGen.createSubnets(vpcId!, region, cidrToAZ);

    const intIdAndRouteTableId =
      await resGen.createInternetGatewayAndRouteTable(vpcId!, region);

    await resGen.createSubnetRouteTableAssociations(
      subnetIds,
      intIdAndRouteTableId.routeTableId,
      region
    );

    const securityGroupId = await resGen.createYugaByteSecurityGroup(
      vpcId!,
      cidrBlock,
      region
    );

    // Update security group to allow traffic from all other VPC CIDRs
    for (const otherRegion in context.regionToCidr) {
      if (otherRegion !== region) {
        await resGen.updateSecurityGroupForCrossRegionTraffic(
          securityGroupId,
          context.regionToCidr[otherRegion],
          region
        );
      }
    }

    // Create network interfaces with public IPs
    let netIntIds: string[] = [];
    let elasticIps: string[] = [];
    for (const subnetId of subnetIds) {
      let currNetIntIdAndIp = await resGen.createNetworkInterfaceWithPublicIP(
        subnetId,
        securityGroupId,
        region
      );
      netIntIds.push(currNetIntIdAndIp.networkInterfaceId);
      elasticIps.push(currNetIntIdAndIp.publicIp);
    }

    // Create SSM instance role (if not already created)
    instanceProfileArn = await resGen.createSSMInstanceRole( "SSMPermissionRole", context.managedTag )

    // Create EC2 instances for this region
    // Distribute RF factor proportionally across regions
    const azs = Object.values(cidrToAZ);

    for (let i = 0; i < context.numNodesPerRegion[regionIdx]; i++) {
      // Track which region this instance is in
      const instancePromise = resGen
        .createEC2Instance(
          `yugabyte-${region}-${i}`,
          region,
          context.params.InstanceType,
          context.params.LatestAmiId,
          context.params.KeyName,
          netIntIds[i],
          true, //change this later
          netIntIds,
          azs[i % azs.length],
          context.params.SshUser
        )
        .then((instance) => ({ ...instance, region }));

      context.allEc2InstanceInfo.push(instancePromise);
    }
    return instanceProfileArn;
}

export async function deployMultiRegion(): Promise<string> {
  const params = await promptForYBParams();
  const placementInfo: PlacementInfo = await promptForPlacementInfo();
  let instanceProfileArnList: string[] = [];

  const managedTag = {
    Key: params.ManagementTagKey,
    Value: params.ManagementTagValue,
  };

  // Variables for deploying infrastructure in each region
  const vpcIds: string[] = [];
  const regionToVpcId: Record<string, string> = {};
  const regionToCidr: Record<string, string> = {};
  const allEc2InstanceInfo: Promise<{
    instanceId: string;
    privateIpAddress?: string;
    publicIp?: string;
    isMasterNode: boolean;
    region: string;
  }>[] = [];
  const masterPrivateIpAddresses: string[] = [];

  const context = {
    placementInfo: placementInfo,
    managedTag: managedTag,
    params: params,
    vpcIds: vpcIds,
    regionToVpcId: regionToVpcId,
    regionToCidr: regionToCidr,
    allEc2InstanceInfo: allEc2InstanceInfo,
    masterPrivateIpAddresses: masterPrivateIpAddresses,
  }

  for (const region of placementInfo.Regions) {
    await resGen.createAndSaveKeyPair(params.KeyName, region);
  }

  // Create base CIDR for each region to avoid overlaps
  for (let i = 0; i < placementInfo.Regions.length; i++) {
    regionToCidr[placementInfo.Regions[i]] = `10.${i}.0.0/16`;
  }

  //figure out how many nodes in each az
  let numNodesPerRegion = Number[placementInfo.NumRegions];
  for (let i = 0; i < placementInfo.NumRegions; i++) {
    if (i <= params.NumberOfNodes % placementInfo.NumRegions) {
      numNodesPerRegion[i] = Math.ceil(
        placementInfo.NumRegions / params.NumberOfNodes
      );
    } else {
      numNodesPerRegion[i] = Math.floor(
        placementInfo.NumRegions / params.NumberOfNodes
      );
    }
  }

  for (let regionIdx = 0; regionIdx < placementInfo.Regions.length; regionIdx++) {
    // TODO: make sure context is being passed correctly
    // context should be getting passed by reference (if not, the ec2 promise logic further down will break)
    instanceProfileArnList.push(await deployResources(context, regionIdx));
  }

  // TODO: Split this code out into its own function (something like setupVpcPeering())
  console.log("\n--- Setting up VPC peering between regions ---");

  if (placementInfo.NumRegions > 1) {
    const peeringConnections: Record<string, string> = {};

    for (let i = 0; i < placementInfo.Regions.length; i++) {
      for (let j = i + 1; j < placementInfo.Regions.length; j++) {
        const sourceRegion = placementInfo.Regions[i];
        const targetRegion = placementInfo.Regions[j];
        const sourceVpcId = regionToVpcId[sourceRegion];
        const targetVpcId = regionToVpcId[targetRegion];
        const sourceCidr = regionToCidr[sourceRegion];
        const targetCidr = regionToCidr[targetRegion];

        console.log(
          `Creating VPC peering between ${sourceRegion} and ${targetRegion}`
        );

        const peeringId = await resGen.createVpcPeering(
          sourceRegion,
          targetRegion,
          sourceVpcId,
          targetVpcId
        );

        await resGen.updateRouteTablesForPeering(
          sourceRegion,
          sourceVpcId,
          targetCidr,
          peeringId
        );

        await resGen.updateRouteTablesForPeering(
          targetRegion,
          targetVpcId,
          sourceCidr,
          peeringId
        );

        peeringConnections[`${sourceRegion}-${targetRegion}`] = peeringId;
      }
    }

    console.log("VPC peering connections established:", peeringConnections);
  }

  // Wait for all instances to be running (context object should have been updated from the deployResources() calls)
  console.log("\n--- Waiting for all instances to be running ---");
  await Promise.all(
    allEc2InstanceInfo.map(async (instancePromise) => {
      const instance = await instancePromise;
      return resGen.waitForInstanceRunning(
        instance.region,
        instance.instanceId
      );
    })
  );

  // Associate instance profiles and collect master IP addresses
  const instances = await Promise.all(allEc2InstanceInfo);

  let iterator = 0;
  for (const instance of instances) {
    await resGen.associateInstanceProfileWithEc2(
      instance.instanceId,
      instanceProfileArnList[iterator],
      instance.region
    );

    if (instance.isMasterNode && instance.privateIpAddress) {
      masterPrivateIpAddresses.push(instance.privateIpAddress);
    }
  }

  // TODO: Split this code out into its own function (something like configureYugabyte())
  // Configure YugabyteDB across all nodes
  console.log("\n--- Configuring YugabyteDB across all regions ---");
  let numTries = 0;
  while (numTries < 30) {
    try {
      // Use the first instance to configure the entire cluster
      const firstInstance = await allEc2InstanceInfo[0];
      const response = await resGen.configureYugabyteDBMultiRegion(
        firstInstance.instanceId,
        params.SshUser,
        firstInstance.region,
        placementInfo.Regions,
        placementInfo.AZs,
        masterPrivateIpAddresses,
        params.RFFactor
      );
      break;
    } catch (err) {
      numTries++;
      console.log("Waiting for instances to be in valid state... " + err);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  if (numTries >= 30) {
    console.log("Instances timed out during configuration");
    throw new Error("Failed to configure YugabyteDB cluster");
  }

  // Show connection information
  const firstInstance = await allEc2InstanceInfo[0];
  console.log(`\n=== YugabyteDB Multi-Region Cluster Deployed ===`);
  console.log(`View YB UI at: http://${firstInstance.publicIp}:7000`);

  // Output information about all instances
  console.log("\nInstances by Region:");
  for (const region of placementInfo.Regions) {
    const regionInstances = instances.filter((i) => i.region === region);
    console.log(`\n${region}:`);
    regionInstances.forEach((instance, idx) => {
      console.log(
        `  Node ${idx + 1}: ${instance.publicIp} (${instance.privateIpAddress})`
      );
    });
  }

  // TODO: Make sure we don't need to return anything
  return "";
}
