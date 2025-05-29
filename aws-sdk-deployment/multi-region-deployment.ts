import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import inquirer from "inquirer";
import * as resGen from "./resource-generator";
import { YugabyteParams, PlacementInfo } from "./types";

export async function deployMultiRegion(): Promise<string> {
  const params = await promptForYBParams()
  const placementInfo: PlacementInfo = await promptForPlacementInfo();

  // Create Tag from params
  const managedTag = {
    Key: params.ManagementTagKey,
    Value: params.ManagementTagValue,
  };

  // Create key pair in each region
  for (const region of placementInfo.Regions) {
    await resGen.createAndSaveKeyPair(params.KeyName, region);
  }

  // Deploy VPCs and infrastructure in each region
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

  // Create base CIDR for each region to avoid overlaps
  for (let i = 0; i < placementInfo.Regions.length; i++) {
    regionToCidr[placementInfo.Regions[i]] = `10.${i}.0.0/16`;
  }
  //figure out how many nodes in each az
//   let numNodesPerAZ = Number[placementInfo.AZs.length]
//   for(let i = 0; i < placementInfo.AZs.length; i++){
//     if(i <= params.NumberOfNodes % placementInfo.AZs.length){
//         numNodesPerAZ[i] = Math.ceil(placementInfo.AZs.length / params.NumberOfNodes)
//     }
//     else{
//         numNodesPerAZ[i] = Math.floor(placementInfo.AZs.length / params.NumberOfNodes)
//     }
//   }
    // Deploy infrastructure in each region
  for(let regionIdx = 0; regionIdx < placementInfo.Regions.length; regionIdx++) {
    const region = placementInfo.Regions[regionIdx];
    const regionAZs = placementInfo.AZs[regionIdx];
    const cidrBlock = regionToCidr[region];
    
    console.log(`\n--- Deploying infrastructure in ${region} (${cidrBlock}) ---`);
    
    // Create VPC in region
    const vpcId = await resGen.createVpc(region, cidrBlock);
    vpcIds.push(vpcId!);
    regionToVpcId[region] = vpcId!;
    
    // Build network config for this region
    // We need to modify this to use the specific AZs selected
    const nodesPerRegion = Math.ceil(params.NumberOfNodes / placementInfo.NumRegions);
    
    // Create subnets based on chosen AZs
    const cidrToAZ: Record<string, string> = {};
    for (let azIdx = 0; azIdx < regionAZs.length; azIdx++) {
      // Create subnet CIDR blocks within the region's VPC CIDR
      cidrToAZ[`10.${regionIdx}.${azIdx}.0/24`] = regionAZs[azIdx % regionAZs.length];
    }
    
    const subnetIds = await resGen.createSubnets(vpcId!, region, cidrToAZ);
    
    // Create internet gateway and route table
    const intIdAndRouteTableId = await resGen.createInternetGatewayAndRouteTable(
      vpcId!,
      region
    );
    
    // Associate subnets with route table
    await resGen.createSubnetRouteTableAssociations(
      subnetIds,
      intIdAndRouteTableId.routeTableId,
      region
    );
    
    // Create security group
    const securityGroupId = await resGen.createYugaByteSecurityGroup(
      vpcId!,
      cidrBlock,
      region
    );
    
    // Update security group to allow traffic from all other VPC CIDRs
    for (const otherRegion in regionToCidr) {
      if (otherRegion !== region) {
        await resGen.updateSecurityGroupForCrossRegionTraffic(
          securityGroupId,
          regionToCidr[otherRegion],
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
    const instanceProfileArn = await resGen.createSSMInstanceRole(
      "SSMPermissionRole",
      managedTag
    );
    
    // Create EC2 instances for this region
    // Distribute RF factor proportionally across regions
    const nodesInRegion = Math.min(
      Math.ceil(params.RFFactor / placementInfo.NumRegions),
      netIntIds.length
    );
    
    const azs = Object.values(cidrToAZ);
    
    for (let i = 0; i < nodesInRegion; i++) {
      // Track which region this instance is in
      const instancePromise = resGen.createEC2Instance(
        `yugabyte-${region}-${i}`,
        region,
        params.InstanceType,
        params.LatestAmiId,
        params.KeyName,
        netIntIds[i],
        true, // We'll make all nodes master-eligible in a multi-region setup
        netIntIds,
        azs[i % azs.length],
        params.SshUser
      ).then(instance => ({...instance, region}));
      
      allEc2InstanceInfo.push(instancePromise);
    }
  }


//   const cidrToAZ = await resGen.buildNetworkConfig(
//     params.Region,
//     params.NumberOfNodes
//   );
//   const subnetIds = await resGen.createSubnets(vpcId!, params.Region, cidrToAZ);

//   const intIdAndRouteTableId = await resGen.createInternetGatewayAndRouteTable(
//     vpcId!,
//     params.Region
//   );

//   const associationResponse = await resGen.createSubnetRouteTableAssociations(
//     subnetIds,
//     intIdAndRouteTableId.routeTableId,
//     params.Region
//   );

//   const securityGroupId = await resGen.createYugaByteSecurityGroup(
//     vpcId!,
//     "10.0.0.0/16",
//     params.Region
//   );

//   let netIntIds: string[] = [];
//   let elasticIps: string[] = [];
//   for (const subnetId of subnetIds) {
//     let currNetIntIdAndIp = await resGen.createNetworkInterfaceWithPublicIP(
//       subnetId,
//       securityGroupId,
//       params.Region
//     );
//     netIntIds.push(currNetIntIdAndIp.networkInterfaceId);
//     elasticIps.push(currNetIntIdAndIp.publicIp);
//   }

//   const instanceProfileArn = await resGen.createSSMInstanceRole(
//     "SSMPermissionRole",
//     managedTag
//   );

//   const azs = Object.values(cidrToAZ);

//   let ec2InstanceInfo: Promise<{
//     instanceId: string;
//     privateIpAddress?: string;
//     publicIp?: string;
//     isMasterNode: boolean;
//   }>[] = [];
//   let masterPrivateIpAddresses: string[] = [];

//   for (let i = 0; i < params.RFFactor; i++) {
//     ec2InstanceInfo.push(
//       resGen.createEC2Instance(
//         `yugabyte-${i}`,
//         params.Region,
//         params.InstanceType,
//         params.LatestAmiId,
//         params.KeyName,
//         netIntIds[i],
//         i < params.RFFactor ? true : false,
//         netIntIds,
//         azs[i],
//         params.SshUser
//       )
//     );
//   }

//   await Promise.all(
//     ec2InstanceInfo.map(async (instancePromise) => {
//       const instance = await instancePromise;
//       return resGen.waitForInstanceRunning(params.Region, instance.instanceId);
//     })
//   );

//   const instances = await Promise.all(ec2InstanceInfo);
//   instances.forEach(({ instanceId }) => {
//     resGen.associateInstanceProfileWithEc2(
//       instanceId,
//       instanceProfileArn,
//       params.Region
//     );
//   });

//   instances.forEach(({ privateIpAddress, isMasterNode }) => {
//     if (isMasterNode) {
//       masterPrivateIpAddresses.push(privateIpAddress!);
//     } else {
//     }
//   });

//   let numTries = 0;
//   while (numTries < 30) {
//     try {
//       const response = await resGen.configureYugabyteNodes(
//         (
//           await ec2InstanceInfo[0]
//         ).instanceId,
//         params.SshUser,
//         params.Region,
//         Object.values(cidrToAZ),
//         masterPrivateIpAddresses,
//         params.RFFactor
//       );
//       break;
//     } catch (err) {
//       numTries++;
//       console.log("Waiting for instance to be in valid state... " + err);
//       await new Promise((resolve) => setTimeout(resolve, 5000));
//     }
//   }

//   if (numTries >= 30) {
//     console.log("Instances timed out");
//   }
//   const firstInstance = await ec2InstanceInfo[0];
//   console.log(`View YB UI at: http://${firstInstance.publicIp}:7000`);
   return "";
}

const PLACEMENTDEFAULTS = {
  NumRegions: 2,
  DefaultRegions: ["us-east-1", "us-west-2"],
};

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

async function promptForYBParams(){

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

  const INSTANCE_TYPES = ["t3.medium", "c5.xlarge", "c5.2xlarge"];

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
