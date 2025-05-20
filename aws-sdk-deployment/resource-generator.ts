import {
  EC2Client,
  CreateVpcCommand,
  CreateSubnetCommand,
  RunInstancesCommand,
  DescribeInstancesCommand,
  _InstanceType,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  CreateInternetGatewayCommand,
  AttachInternetGatewayCommand,
  CreateRouteTableCommand,
  CreateRouteCommand,
  CreateTagsCommand,
  AssociateRouteTableCommand,
  AssociateRouteTableCommandOutput,
  CreateNetworkInterfaceCommand,
  BlockDeviceMapping,
  DescribeNetworkInterfacesCommand,
  waitUntilInstanceRunning,
  AllocateAddressCommand,
  AssociateAddressCommand,
  IamInstanceProfileSpecification,
} from "@aws-sdk/client-ec2";
import {
  SSMClient,
  SendCommandCommand,
  GetParameterCommand,
} from "@aws-sdk/client-ssm";

import inquirer from "inquirer";
import { YugabyteParams } from "./types";
import {
  IAMClient,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  CreateInstanceProfileCommand,
  AddRoleToInstanceProfileCommand,
} from "@aws-sdk/client-iam";


export async function createSSMInstanceRole(roleName: string) {
  const iamClient = new IAMClient({ region: "us-east-1" });

  // Trust policy for EC2
  const assumeRolePolicyDocument = JSON.stringify({
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
  await iamClient.send(
    new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: assumeRolePolicyDocument,
    })
  );

  // 2. Attach AmazonSSMManagedInstanceCore Policy
  await iamClient.send(
    new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
    })
  );

  // 3. Create Instance Profile (required for EC2 attachment)
  await iamClient.send(
    new CreateInstanceProfileCommand({
      InstanceProfileName: roleName,
    })
  );

  // 4. Add Role to Instance Profile
  await iamClient.send(
    new AddRoleToInstanceProfileCommand({
      InstanceProfileName: roleName,
      RoleName: roleName,
    })
  );

  console.log(`Created EC2 IAM role and instance profile: ${roleName}`);

  return roleName;
}

const DEFAULTS: YugabyteParams = {
  DBVersion: "2024.2.2.1-b190",
  RFFactor: 3,
  KeyName: "",
  InstanceType: "t3.medium",
  LatestAmiId:
    "/aws/service/canonical/ubuntu/server/jammy/stable/current/amd64/hvm/ebs-gp2/ami-id",
  SshUser: "ubuntu",
  DeploymentType: "Multi-AZ",
  Region: "us-east-1"
};

const INSTANCE_TYPES = ["t3.medium", "c5.xlarge", "c5.2xlarge"];
const DEPLOYMENT_TYPES = ["Multi-AZ", "Single-Server", "Multi-Region"];
export async function promptForParams(): Promise<YugabyteParams> {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "DBVersion",
      message: `DBVersion`,
      default: DEFAULTS.DBVersion,
    },
    {
      type: "input",
      name: "RFFactor",
      message: `RFFactor`,
      default: String(DEFAULTS.RFFactor),
    },
    {
      type: "input",
      name: "KeyName",
      message: "KeyName (required)",
      default: "Key",
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
  ]);

  return answers as YugabyteParams;
}
/**
 * Creates an EC2 instance in the network interface it is passed.
 * Sets up user data to install necessary libraries, start necessary tools, and initialize tserver and master server
 * 
 */
export async function createEC2Instance(
  name: string,
  region: string,
  instanceType: string,
  imageId: string,
  keyName: string,
  securityGroup: string,
  netIntId: string,
  vpcId: string,
  isMasterNode: boolean = false,
  masterNetIntIds: string[] = [],
  zone?: string,
  sshUser: string = "ubuntu"
) {
  const ec2Client = new EC2Client({ region });
  try {    const blockDeviceMappings: BlockDeviceMapping[] = [
      {
        DeviceName: "/dev/xvda",
        Ebs: {
          VolumeSize: 50,
          DeleteOnTermination: true,
          VolumeType: "gp2",
        },
      },
    ];

    //gets internal ip addresses from other nodes
    const nodePrivateIp = await getPrimaryPrivateIpAddress(netIntId);
    const masterPrivateIps = await Promise.all(
      masterNetIntIds.map((id) => getPrimaryPrivateIpAddress(id))
    );

    //LOOK HERE!!
    const iamInstanceProfileSpec: IamInstanceProfileSpecification = {
      Name: name
    };

    const instanceParams = {
      ImageId: await getAmiIdFromSSM(imageId),
      InstanceType: instanceType as _InstanceType,
      IamInstanceProfile: iamInstanceProfileSpec,


      MinCount: 1,
      MaxCount: 1,
      KeyName: keyName,
      NetworkInterfaces: [
        {
          DeviceIndex: 0,
          NetworkInterfaceId: netIntId,
        },
      ],
      BlockDeviceMappings: blockDeviceMappings,
      UserData: Buffer.from(
        generateUserData(
          isMasterNode,
          masterPrivateIps,
          zone || `${region}a`,
          region,
          sshUser,
          nodePrivateIp
        )
      ).toString("base64"),
    };

    // Create the instance
    const command = new RunInstancesCommand(instanceParams);
    const data = await ec2Client.send(command);

    // Extract the instance ID
    const instance = data.Instances?.[0];
    const instanceId = instance?.InstanceId;
    const privateIpAddress = instance?.PrivateIpAddress;

    console.log(`Successfully created EC2 instance with ID: ${instanceId}`);
    console.log(`Instance is ${isMasterNode ? "a MASTER" : "a TSERVER"} node`);

    if (!instanceId) {
      throw new Error("Instance ID is undefined.");
    }

    return {
      instanceId,
      privateIpAddress,
      isMasterNode,
    };
  } catch (err) {
    console.error("Error creating EC2 instance:", err);
    throw err;
  }
}
export async function getPrimaryPrivateIpAddress(
  networkInterfaceId: string
): Promise<string> {
  // Initialize the EC2 client
  const ec2Client = new EC2Client({});

  try {
    // Request details about the network interface
    const response = await ec2Client.send(
      new DescribeNetworkInterfacesCommand({
        NetworkInterfaceIds: [networkInterfaceId],
      })
    );

    // Check if we got a valid response
    if (
      !response.NetworkInterfaces ||
      response.NetworkInterfaces.length === 0
    ) {
      throw new Error(`Network interface ${networkInterfaceId} not found`);
    }

    // Get the primary private IP address
    const primaryPrivateIpAddress =
      response.NetworkInterfaces[0].PrivateIpAddress;

    if (!primaryPrivateIpAddress) {
      throw new Error(
        `No primary private IP address found for network interface ${networkInterfaceId}`
      );
    }

    console.log(
      `Primary private IP address for ${networkInterfaceId}: ${primaryPrivateIpAddress}`
    );
    return primaryPrivateIpAddress;
  } catch (error) {
    console.error(
      `Error getting primary private IP address for network interface ${networkInterfaceId}:`,
      error
    );
    throw error;
  }
}
// Helper function to generate the user data script for the EC2 instance
function generateUserData(
  isMasterNode: boolean,
  masterPrivateIps: string[],
  zone: string,
  region: string,
  sshUser: string,
  nodePrivateIp: string
): string {
  // Format master addresses for YugaByteDB configuration
  const masterAddresses = masterPrivateIps.map((ip) => `${ip}:7100`).join(",");

  return `#!/bin/bash -xe
apt-get update -y
apt-get install -y python3-pip

# Install required software
cd /home/${sshUser}
wget https://software.yugabyte.com/releases/2024.2.2.2/yugabyte-2024.2.2.2-b2-linux-x86_64.tar.gz
tar xvfz yugabyte-2024.2.2.2-b2-linux-x86_64.tar.gz
cd yugabyte-2024.2.2.2/
./bin/post_install.sh

# Download configuration scripts
cd /home/${sshUser}
curl -o install_software.sh https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/install_software.sh
curl -o start_master.sh https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/start_master.sh
curl -o start_tserver.sh https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/start_tserver.sh
curl -o set_replica_policy.sh https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/set_replica_policy.sh
chmod +x *.sh
bash install_software.sh

# Run the appropriate node setup script based on node type
cd /home/${sshUser}/yugabyte-2024.2.2.2
${
  isMasterNode
    ? `sudo -u ${sshUser} /home/${sshUser}/start_master.sh ${nodePrivateIp} ${zone} ${region} /home/${sshUser} '${masterAddresses}'`
    : `sudo -u ${sshUser} /home/${sshUser}/start_tserver.sh ${nodePrivateIp} ${zone} ${region} /home/${sshUser} '${masterAddresses}'`
}
`;
}
/**
 * Waits for an EC2 instance to reach the 'running' state and logs its public IP.
 * Uses the built-in AWS SDK waitUntilInstanceRunning waiter.
 *
 * @param region - The AWS region where the instance exists
 * @param instanceId - The ID of the EC2 instance to wait for
 * @returns A promise that resolves when the instance is running
 */
export async function waitForInstanceRunning(
  region: string,
  instanceId: string
) {
  const ec2Client = new EC2Client({ region });
  console.log(`Waiting for instance ${instanceId} to be in 'running' state...`);

  try {
    // Use the built-in waiter to wait for the instance to be running
    await waitUntilInstanceRunning(
      {
        client: ec2Client,
        // Optional configuration
        maxWaitTime: 300, // 5 minutes maximum wait time
        minDelay: 2, // Min seconds between attempts
        maxDelay: 10, // Max seconds between attempts
      },
      { InstanceIds: [instanceId] }
    );

    // Once running, get instance details including the public IP
    const describeCommand = new DescribeInstancesCommand({
      InstanceIds: [instanceId],
    });

    const data = await ec2Client.send(describeCommand);
    const instance = data.Reservations?.[0]?.Instances?.[0];
    const publicIp = instance?.PublicIpAddress;

    console.log(`Instance ${instanceId} is now running!`);

    if (publicIp) {
      console.log(`Public IP address: ${publicIp}`);
    } else {
      console.log(`No public IP address assigned to instance ${instanceId}`);
    }

    return { instanceId, publicIp };
  } catch (err) {
    console.error(`Error waiting for instance ${instanceId} to run:`, err);
    throw err;
  }
}

export async function createVpc(
  cidrBlock: string,
  name: string
): Promise<string | undefined> {
  const ec2Client = new EC2Client({ region: "us-east-1" });

  try {
    const createVpcCommand = new CreateVpcCommand({
      CidrBlock: cidrBlock,
    });
    const vpcResult = await ec2Client.send(createVpcCommand);

    const vpcId = vpcResult.Vpc?.VpcId;
    if (!vpcId) throw new Error("Failed to retrieve VPC ID");

    console.log(`VPC created with ID: ${vpcId}`);
    return vpcId;
  } catch (err) {
    console.error("Error creating VPC:", err);
    return undefined;
  }
}

export async function createSubnets(
  vpcId: string,
  azToCidr: { [az: string]: string } // e.g., { "us-east-1a": "10.0.0.0/24", "us-east-1b": "10.0.1.0/24" }
): Promise<string[]> {
  const ec2Client = new EC2Client({ region: "us-east-1" });
  const subnetIds: string[] = [];
  console.log("Creating subnets...");
  for (const [az, cidr] of Object.entries(azToCidr)) {
    const subnetCommand = new CreateSubnetCommand({
      VpcId: vpcId,
      AvailabilityZone: az,
      CidrBlock: cidr,
    });

    const result = await ec2Client.send(subnetCommand);
    const subnetId = result.Subnet?.SubnetId;
    if (subnetId) {
      subnetIds.push(subnetId);
      console.log(`Created subnet ${subnetId} in ${az}`);
    } else {
      console.warn(`Failed to create subnet in ${az}`);
    }
  }
  console.log("Subnets created!");
  return subnetIds;
}

export async function createYugaByteSecurityGroup(
  vpcId: string,
  vpcCidr: string
): Promise<string> {
  // Initialize the EC2 client
  const ec2Client = new EC2Client({});

  // Create the security group
  const createSgParams = {
    Description: "YugaByte Node Security Group",
    GroupName: "YugaByteNodeSG",
    VpcId: vpcId,
    TagSpecifications: [
      {
        ResourceType: "security-group" as const,
        Tags: [
          {
            Key: "Name",
            Value: "YugaByteSecurityGroup",
          },
        ],
      },
    ],
  };

  try {
    // Create the security group
    const createSgResponse = await ec2Client.send(
      new CreateSecurityGroupCommand(createSgParams)
    );

    const securityGroupId = createSgResponse.GroupId;

    if (!securityGroupId) {
      throw new Error("Failed to get security group ID after creation");
    }

    // Define the ingress rules
    const ingressRules = [
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
    await ec2Client.send(
      new AuthorizeSecurityGroupIngressCommand({
        GroupId: securityGroupId,
        IpPermissions: ingressRules,
      })
    );

    console.log(
      `Successfully created YugaByte security group: ${securityGroupId}`
    );
    return securityGroupId;
  } catch (error) {
    console.error("Error creating YugaByte security group:", error);
    throw error;
  }
}

/**
 * Creates an Internet Gateway, attaches it to a VPC, and creates a public route table
 * @param vpcId - The ID of the VPC to attach the Internet Gateway to
 * @returns Promise resolving to the created resources' IDs
 */
export async function createInternetGatewayAndRouteTable(
  vpcId: string
): Promise<{
  internetGatewayId: string;
  routeTableId: string;
}> {
  // Initialize the EC2 client
  const ec2Client = new EC2Client({});

  try {
    // Step 1: Create Internet Gateway
    const createIgwResponse = await ec2Client.send(
      new CreateInternetGatewayCommand({})
    );

    const internetGatewayId =
      createIgwResponse.InternetGateway?.InternetGatewayId;

    if (!internetGatewayId) {
      throw new Error("Failed to get Internet Gateway ID after creation");
    }

    // Step 3: Attach Internet Gateway to VPC
    await ec2Client.send(
      new AttachInternetGatewayCommand({
        InternetGatewayId: internetGatewayId,
        VpcId: vpcId,
      })
    );

    // Step 4: Create Public Route Table
    const createRouteTableResponse = await ec2Client.send(
      new CreateRouteTableCommand({
        VpcId: vpcId,
      })
    );

    const routeTableId = createRouteTableResponse.RouteTable?.RouteTableId;

    if (!routeTableId) {
      throw new Error("Failed to get Route Table ID after creation");
    }

    // Step 6: Create Public Route
    await ec2Client.send(
      new CreateRouteCommand({
        RouteTableId: routeTableId,
        DestinationCidrBlock: "0.0.0.0/0",
        GatewayId: internetGatewayId,
      })
    );

    console.log(
      `Successfully created Internet Gateway ${internetGatewayId} and Route Table ${routeTableId} for VPC ${vpcId}`
    );

    return {
      internetGatewayId,
      routeTableId,
    };
  } catch (error) {
    console.error("Error creating Internet Gateway and Route Table:", error);
    throw error;
  }
}

/**
 * Associates a subnet with a route table
 * @param subnetId - The ID of the subnet to associate
 * @param routeTableId - The ID of the route table to associate with the subnet
 * @returns Promise resolving to the association response
 */
export async function createSubnetRouteTableAssociations(
  subnetIds: string[],
  routeTableId: string
): Promise<AssociateRouteTableCommandOutput[]> {
  // Initialize the EC2 client
  const ec2Client = new EC2Client({});
  const associationResponses: AssociateRouteTableCommandOutput[] = [];

  try {
    // Create association for each subnet
    for (const subnetId of subnetIds) {
      const associationResponse = await ec2Client.send(
        new AssociateRouteTableCommand({
          SubnetId: subnetId,
          RouteTableId: routeTableId,
        })
      );

      console.log(
        `Successfully associated subnet ${subnetId} with route table ${routeTableId}`
      );
      console.log(`Association ID: ${associationResponse.AssociationId}`);

      associationResponses.push(associationResponse);
    }

    console.log(
      `Associated ${subnetIds.length} subnets with route table ${routeTableId}`
    );
    return associationResponses;
  } catch (error) {
    console.error(
      `Error associating subnets with route table ${routeTableId}:`,
      error
    );
    throw error;
  }
}

/**
 * Creates a network interface in the specified subnet with the provided security group,
 * and associates an Elastic IP address with it.
 *
 * @param subnetId - The subnet ID where the network interface will be created
 * @param securityGroupId - The security group to attach to the network interface
 * @returns A promise resolving to an object containing the network interface ID and public IP address
 */
export async function createNetworkInterfaceWithPublicIP(
  subnetId: string,
  securityGroupId: string
): Promise<{ networkInterfaceId: string; publicIp: string }> {
  const ec2Client = new EC2Client({});

  try {
    // Step 1: Create the network interface
    const createResponse = await ec2Client.send(
      new CreateNetworkInterfaceCommand({
        SubnetId: subnetId,
        Groups: [securityGroupId],
      })
    );

    const networkInterfaceId =
      createResponse.NetworkInterface?.NetworkInterfaceId;
    if (!networkInterfaceId) {
      throw new Error("Failed to get network interface ID after creation");
    }

    // Step 2: Allocate an Elastic IP
    const allocateResponse = await ec2Client.send(
      new AllocateAddressCommand({
        Domain: "vpc",
      })
    );

    const allocationId = allocateResponse.AllocationId;
    const publicIp = allocateResponse.PublicIp;

    if (!allocationId || !publicIp) {
      throw new Error("Failed to allocate Elastic IP");
    }

    const privateIp = createResponse.NetworkInterface?.PrivateIpAddress;
    if (!privateIp) {
      throw new Error("Failed to retrieve private IP from network interface");
    }

    await ec2Client.send(
      new AssociateAddressCommand({
        AllocationId: allocationId,
        NetworkInterfaceId: networkInterfaceId,
        PrivateIpAddress: privateIp,
      })
    );

    console.log(
      `Created network interface ${networkInterfaceId} in subnet ${subnetId}`
    );
    console.log(`Associated Elastic IP ${publicIp} with the network interface`);

    // Return both the network interface ID and the public IP
    return {
      networkInterfaceId,
      publicIp,
    };
  } catch (error) {
    console.error("Error creating network interface with public IP:", error);
    throw error;
  }
}

export async function configureYugabyteNodes(
  instanceId: string,
  sshUser: string,
  region: string,
  zones: string[],
  masterAddresses: string[],
  replicationFactor = 3,
  scriptUrl = "https://raw.githubusercontent.com/cloud303-mpena/cloud303-yugabyte-deployment/refs/heads/master/scripts/modify_placement.sh"
) {
  // Create SSM client
  const ssmClient = new SSMClient({ region });

  // Format master addresses as a comma-separated list
  const masterAddressesString = masterAddresses.join(",");

  // Command to download the script from GitHub and run it
  const command = `
    # Download replica policy script
    cd /home/${sshUser}
    curl -o set_replica_policy.sh ${scriptUrl}
    chmod +x set_replica_policy.sh
    
    # Run the script
    cd /home/${sshUser}/yugabyte-2024.2.2.2
    sudo -u ${sshUser} /home/${sshUser}/set_replica_policy.sh ${region} ${zones} ${replicationFactor} '${masterAddressesString}'
  `;

  // Execute the command on the target instance using SSM Run Command
  const response = await ssmClient.send(
    new SendCommandCommand({
      DocumentName: "AWS-RunShellScript",
      InstanceIds: [instanceId],
      Parameters: {
        commands: [command],
      },
    })
  );

  return response;
}
async function getAmiIdFromSSM(parameterName: string): Promise<string> {
  const client = new SSMClient({ region: "us-east-1" });

  const command = new GetParameterCommand({
    Name: parameterName,
    WithDecryption: false,
  });

  const response = await client.send(command);
  return response.Parameter?.Value || "";
}
