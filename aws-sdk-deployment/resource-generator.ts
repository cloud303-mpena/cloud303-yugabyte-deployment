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
  AssociateIamInstanceProfileCommand,
  DescribeAvailabilityZonesCommand,
  CreateKeyPairCommand,
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
  GetInstanceProfileCommand,
} from "@aws-sdk/client-iam";
import { get } from "http";
import { writeFileSync } from "fs";
import { resolve } from "path";

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
  Region: "us-east-1",
};

const INSTANCE_TYPES = ["t3.medium", "c5.xlarge", "c5.2xlarge"];
const DEPLOYMENT_TYPES = ["Multi-AZ", "Single-Server", "Multi-Region"];
/**
 * Prompts the user for Yugabyte deployment parameters using interactive CLI inputs.
 *
 * @returns {Promise<YugabyteParams>} A promise that resolves to an object containing the user's input for deployment parameters.
 */
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
      validate: (input) => (parseInt(input, 10) % 2 == 1)
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
export async function createSSMInstanceRole(roleName: string): Promise<string> {
  const iamClient = new IAMClient();
  //Trust policy for EC2
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
  try {
    // Create IAM Role
    await iamClient.send(
      new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: assumeRolePolicyDocument,
      })
    );

    // Attach AmazonSSMManagedInstanceCore Policy
    await iamClient.send(
      new AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
      })
    );

    // Create Instance Profile (required for EC2 attachment)
    await iamClient.send(
      new CreateInstanceProfileCommand({
        InstanceProfileName: roleName,
      })
    );

    // Add Role to Instance Profile
    await iamClient.send(
      new AddRoleToInstanceProfileCommand({
        InstanceProfileName: roleName,
        RoleName: roleName,
      })
    );

  } catch (error) {
    //TODO: change to make sure the error is that it already exists
      if ((error as any).name === "EntityAlreadyExistsException"){

      }
  }
      // Get the instance profile to retrieve its ARN
    const getInstanceProfileResponse = await iamClient.send(
      new GetInstanceProfileCommand({
        InstanceProfileName: roleName,
      })
    );

    const instanceProfileArn = getInstanceProfileResponse.InstanceProfile?.Arn;
    console.log(
      `Created EC2 IAM role and instance profile: ${roleName} with ARN: ${instanceProfileArn}`
    );

    return instanceProfileArn || "";
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
export async function createEC2Instance(
  name: string,
  region: string,
  instanceType: string,
  imageId: string,
  keyName: string,
  netIntId: string,
  isMasterNode: boolean = false,
  masterNetIntIds: string[],
  zone: string,
  sshUser: string
) {
  const ec2Client = new EC2Client({ region });
  try {
    const blockDeviceMappings: BlockDeviceMapping[] = [
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
    const nodePrivateIp = await getPrimaryPrivateIpAddress(region, netIntId);
    const masterPrivateIps = await Promise.all(
      masterNetIntIds.map((id) => getPrimaryPrivateIpAddress(region, id, false))
    );

    const instanceParams = {
      Name: name,
      ImageId: await getAmiIdFromSSM(imageId),
      InstanceType: instanceType as _InstanceType,
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
    console.log("Waiting for running state...");
    await waitUntilInstanceRunning(
      { client: ec2Client, maxWaitTime: 1000 },
      { InstanceIds: [instanceId!] }
    );
    console.log(`Instance ${name} is running!`);
    if (!instanceId) {
      throw new Error("Instance ID is undefined.");
    }
    const publicIp = await ec2Client.send(new DescribeNetworkInterfacesCommand({ NetworkInterfaceIds: [netIntId] }))
  .then(res => res.NetworkInterfaces?.[0]?.Association?.PublicIp);
    return {
      instanceId,
      privateIpAddress,
      publicIp,
      isMasterNode,
    };
  } catch (err) {
    console.error("Error creating EC2 instance:", err);
    throw err;
  }
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
export async function associateInstanceProfileWithEc2(
  instanceId: string,
  instanceProfileArn: string,
  region: string
) {
  console.log(
    `Associating instance ${instanceId} with instance profile ${instanceProfileArn}`
  );
  const ec2Client = new EC2Client({ region: region});
  await ec2Client.send(
    new AssociateIamInstanceProfileCommand({
      IamInstanceProfile: {
        Arn: instanceProfileArn,
      },
      InstanceId: instanceId,
    })
  );
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
export async function getPrimaryPrivateIpAddress(
  region: string,
  networkInterfaceId: string,
  doPrint: boolean = true
): Promise<string> {
  // Initialize the EC2 client
  const ec2Client = new EC2Client({region});

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
    if (doPrint) {
      console.log(
        `Primary private IP address for ${networkInterfaceId}: ${primaryPrivateIpAddress}`
      );
    }
    return primaryPrivateIpAddress;
  } catch (error) {
    console.error(
      `Error getting primary private IP address for network interface ${networkInterfaceId}:`,
      error
    );
    throw error;
  }
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
    ? `sudo -u ${sshUser} /home/${sshUser}/start_master.sh ${nodePrivateIp} ${zone} ${region} /home/${sshUser} '${masterAddresses}'
sudo -u ${sshUser} /home/${sshUser}/start_tserver.sh ${nodePrivateIp} ${zone} ${region} /home/${sshUser} '${masterAddresses}'`
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
  const ec2Client = new EC2Client({ region: region });
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

/**
 * Creates an AWS VPC with the specified CIDR block and name tag.
 * @param {string} region - region to deploy the VPC in
 * @param {string} cidrBlock - The IPv4 CIDR block for the VPC
 * @returns {Promise<string | undefined>} The ID of the created VPC or undefined if creation fails
 */
export async function createVpc(
  region: string,
  cidrBlock: string
): Promise<string | undefined> {
  const ec2Client = new EC2Client({ region: region});

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
/**
 * Creates subnets in the specified VPC using a mapping of CIDR blocks to availability zones.
 *
 * @param {string} vpcId - The ID of the VPC where subnets will be created
 * @param {string} region - Region to initialize ec2Client
 * @param {Object} cidrToAZ - Mapping of CIDR blocks to availability zones
 * @returns {Promise<string[]>} Array of created subnet IDs
 */
export async function createSubnets(
  vpcId: string,
  region: string,
  cidrToAZ: { [cidr: string]: string }
): Promise<string[]> {
  const ec2Client = new EC2Client({ region: region});
  const subnetIds: string[] = [];
  console.log("Creating subnets...");
  
  for (const [cidr, az] of Object.entries(cidrToAZ)) {
    const subnetCommand = new CreateSubnetCommand({
      VpcId: vpcId,
      AvailabilityZone: az,
      CidrBlock: cidr,
    });
    const result = await ec2Client.send(subnetCommand);
    const subnetId = result.Subnet?.SubnetId;
    if (subnetId) {
      subnetIds.push(subnetId);
      console.log(`Created subnet ${subnetId} with CIDR ${cidr} in ${az}`);
    } else {
      console.warn(`Failed to create subnet with CIDR ${cidr} in ${az}`);
    }
  }
  console.log("Subnets created!");
  return subnetIds;
}
/**
 * Creates a security group for YugabyteDB with the necessary inbound and outbound rules.
 *
 * @param {string} vpcId - The ID of the VPC where the security group will be created
 * @param {string} vpcCidr - The CIDR block of the VPC for configuring security group rules
 * @param {string} region - Region to initialize ec2Client
 * @returns {Promise<string>} The ID of the created security group
 */
export async function createYugaByteSecurityGroup(
  vpcId: string,
  vpcCidr: string,
  region: string
): Promise<string> {
  // Initialize the EC2 client
  const ec2Client = new EC2Client({region: region});

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
        IpRanges: [{ CidrIp: "0.0.0.0/0" }],
      },
      // YEDIS port
      {
        IpProtocol: "tcp",
        FromPort: 6379,
        ToPort: 6379,
        IpRanges: [{ CidrIp: "0.0.0.0/0" }],
      },
      // YSQL port
      {
        IpProtocol: "tcp",
        FromPort: 5433,
        ToPort: 5433,
        IpRanges: [{ CidrIp: "0.0.0.0/0" }],
      },
      // YCQL port
      {
        IpProtocol: "tcp",
        FromPort: 9042,
        ToPort: 9042,
        IpRanges: [{ CidrIp: "0.0.0.0/0" }],
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
 * @param {string} region - Region to initialize ec2Client
 * @returns Promise resolving to the created resources' IDs
 */
export async function createInternetGatewayAndRouteTable(
  vpcId: string,
  region: string
): Promise<{
  internetGatewayId: string;
  routeTableId: string;
}> {
  // Initialize the EC2 client
  const ec2Client = new EC2Client({region: region});

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
 * @param {string} region - Region to initialize ec2Client
 * @returns Promise resolving to the association response
 */
export async function createSubnetRouteTableAssociations(
  subnetIds: string[],
  routeTableId: string,
  region: string
): Promise<AssociateRouteTableCommandOutput[]> {
  // Initialize the EC2 client
  const ec2Client = new EC2Client({region: region});
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
 * @param {string} region - Region to initialize ec2Client
 * @returns A promise resolving to an object containing the network interface ID and public IP address
 */
export async function createNetworkInterfaceWithPublicIP(
  subnetId: string,
  securityGroupId: string,
  region: string
): Promise<{ networkInterfaceId: string; publicIp: string }> {
  const ec2Client = new EC2Client({region: region});

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

/**
 * Retrieves an AMI ID from AWS Systems Manager Parameter Store.
 *
 * @param {string} parameterName - The name of the SSM parameter containing the AMI ID
 * @returns {Promise<string>} The AMI ID stored in the parameter, or empty string if not found
 */
async function getAmiIdFromSSM(parameterName: string): Promise<string> {
  const client = new SSMClient({ region: "us-east-1" });

  const command = new GetParameterCommand({
    Name: parameterName,
    WithDecryption: false,
  });

  const response = await client.send(command);
  return response.Parameter?.Value || "";
}
/**
 * Gets available Availability Zones for a specific region.
 *
 * @param {string} region - AWS region to query
 * @returns {Promise<string[]>} Array of available AZ names
 */
export async function getAvailableAZs(region: string): Promise<string[]> {
  // Create EC2 client for the specified region
  const ec2Client = new EC2Client({ region });
  
  // Create command to describe AZs
  const command = new DescribeAvailabilityZonesCommand({
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
  
  try {
    // Execute the command
    const response = await ec2Client.send(command);
    
    // Extract AZ names from the response
    const azNames = response.AvailabilityZones?.map(az => az.ZoneName || "") || [];
    
    // Filter out any empty strings
    return azNames.filter(name => name !== "");
  } catch (error) {
    console.error(`Error fetching availability zones for region ${region}:`, error);
    throw error;
  }
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
export async function buildNetworkConfig(region: string, numberOfNodes: number): Promise<{ [cidr: string]: string }> {
  // Get actual AZs available in the region
  const availableAZs = await getAvailableAZs(region);
  
  if (availableAZs.length === 0) {
    throw new Error(`No availability zones found for region: ${region}`);
  }
  
  // Create CIDR to AZ mapping
  const cidrToAZ: { [cidr: string]: string } = {};
  
  for (let i = 0; i < numberOfNodes; i++) {
    // Create CIDR with third octet incrementing for each subnet
    const cidr = `10.0.${i}.0/24`;
    
    // Assign AZ in round-robin fashion
    const azIndex = i % availableAZs.length;
    const az = availableAZs[azIndex];
    
    cidrToAZ[cidr] = az;
  }
  
  return cidrToAZ;
}
/**
 * Creates an EC2 key pair and saves the private key to a .pem file.
 *
 * @param {string} keyName - The name of the key pair to create.
 * @param {region} region - name of the region for the ec2 client
 * @returns {Promise<"success" | "fail">} - Returns "success" if the key was created and saved, otherwise "fail".
 *
 */
export async function createAndSaveKeyPair(keyName: string, region: string): Promise<"success" | "fail"> {
  console.log(`Creating key pair of name ${keyName} ...`)
  const ec2Client = new EC2Client({region: region})
  try {
    const key = await ec2Client.send(new CreateKeyPairCommand({ KeyName: keyName }));
    if (!key.KeyMaterial){
      throw new Error("No KeyMaterial returned");
    }
    const filePath = resolve(`${keyName}.pem`);
    writeFileSync(filePath, key.KeyMaterial, { mode: 0o400 });

    console.log(`Private key saved to: ${filePath}`);
    return "success";
  } catch (err) {
    console.error("Error creating key pair:", err);
    return "fail";
  }
}