// import {
//     DescribeInstancesCommand,
//     EC2Client,
//     TerminateInstancesCommand,
//     DeleteNetworkInterfaceCommand,
//     DescribeNetworkInterfacesCommand,
//     ReleaseAddressCommand,
//     DescribeAddressesCommand,
//     Tag,
//     waitUntilInstanceTerminated,
//     DescribeVpcsCommand,
//     DeleteVpcCommand,
//     DescribeInternetGatewaysCommand,
//     DetachInternetGatewayCommand,
//     DeleteInternetGatewayCommand,
//     DescribeSubnetsCommand,
//     DeleteSubnetCommand,
//     DescribeSecurityGroupsCommand,
//     DeleteSecurityGroupCommand,
//     DescribeRouteTablesCommand,
//     DeleteRouteTableCommand,
//     DisassociateRouteTableCommand
// } from "@aws-sdk/client-ec2";
// import {
//     IAMClient,
//     DeleteRoleCommand,
//     ListRolePoliciesCommand,
//     DetachRolePolicyCommand,
//     DeleteRolePolicyCommand,
//     ListAttachedRolePoliciesCommand,
//     ListRolesCommand,
//     ListRoleTagsCommand,
//     ListInstanceProfilesCommand,
//     RemoveRoleFromInstanceProfileCommand,
//     DeleteInstanceProfileCommand
// } from "@aws-sdk/client-iam";
// import { fileURLToPath } from "node:url";
// import { parseArgs } from "node:util";
// import {YugabyteParams} from "./types";
// import * as resGen from "./resource-generator";
// import inquirer from "inquirer";

// const DEFAULTS: YugabyteParams = {
//     DBVersion: "2024.2.2.1-b190",
//     RFFactor: 3,
//     NumberOfNodes: 3,
//     KeyName: "",
//     InstanceType: "t3.medium",
//     LatestAmiId:
//         "/aws/service/canonical/ubuntu/server/jammy/stable/current/amd64/hvm/ebs-gp2/ami-id",
//     SshUser: "ubuntu",
//     DeploymentType: "Multi-AZ",
//     ManagementTagKey: "c303-yugabyte-managed",
//     ManagementTagValue: "true",
//     Region: "us-east-1",
// };

// const managedTag = { Key: "c303-yugabyte-managed", Value: "true" };
// const managedTagType: Tag = {
//     Key: "c303-yugabyte-managed",
//     Value: "true",
// }

// const DEPLOYMENT_TYPES = ["Multi-AZ", "Single-Server", "Multi-Region"];
// /**
//  * Prompts the user for Yugabyte deployment parameters using interactive CLI inputs.
//  *
//  * @returns {Promise<YugabyteParams>} A promise that resolves to an object containing the user's input for deployment parameters.
//  */
// export async function promptForParams(): Promise<YugabyteParams> {
//     const answers = await inquirer.prompt([
//         {
//             type: "input",
//             name: "Region",
//             message: "Region",
//             default: DEFAULTS.Region,
//         },
//         {
//             type: "input",
//             name: "ManagementTagKey",
//             message: "ManagementTagKey",
//             default: DEFAULTS.ManagementTagKey,
//         },
//         {
//             type: "input",
//             name: "ManagementTagValue",
//             message: "ManagementTagValue",
//             default: DEFAULTS.ManagementTagValue,
//         },
//     ]);

//     return answers as YugabyteParams;
// }
// /**
//  * Delete resources in the specified order:
//  * 1. Terminate EC2 Instances
//  * 2. Delete Network Interfaces
//  * 3. Release Elastic IPs
//  * 4. Delete Role
//  */
// async function destroyUniverse(region: string, managedTag: {Key: string, Value: string}) {
//     const ec2Client = new EC2Client({ region: region });
//     const iamClient = new IAMClient({ region: region });

//     // --- 1. Terminate EC2 instances ---
//     console.log("Step 1: Terminating EC2 instances...");

//     // Get EC2 instances that are tagged as managed
//     const taggedInput = {
//         Filters: [
//             {
//                 Name: `tag:${managedTag.Key}`,
//                 Values: [managedTag.Value],
//             },
//         ],
//     };

//     const describeCommand = new DescribeInstancesCommand(taggedInput);
//     const response = await ec2Client.send(describeCommand);
//     let instanceIds = [];
//     let networkInterfaceIds = [];

//     // Check if Reservations exists and is an array
//     if (response.Reservations && Array.isArray(response.Reservations)) {
//         for (const reservation of response.Reservations) {
//             if (reservation.Instances && Array.isArray(reservation.Instances)) {
//                 for (const instance of reservation.Instances) {
//                     // Check if InstanceId exists on the instance object
//                     if (instance.InstanceId) {
//                         instanceIds.push(instance.InstanceId);
//                     }

//                     // Collect network interface IDs
//                     if (instance.NetworkInterfaces) {
//                         for (const netInterface of instance.NetworkInterfaces) {
//                             if (netInterface.NetworkInterfaceId) {
//                                 networkInterfaceIds.push(netInterface.NetworkInterfaceId);
//                             }
//                         }
//                     }
//                 }
//             }
//         }
//     }

//     // Terminate instances if any were found
//     if (instanceIds.length > 0) {
//         try {
//             const command = new TerminateInstancesCommand({ InstanceIds: instanceIds });
//             const { TerminatingInstances } = await ec2Client.send(command);

//             if (TerminatingInstances) {
//                 const instanceList = TerminatingInstances.map(
//                     (instance) => `• ${instance.InstanceId}`
//                 );
//                 console.log("Terminating instances:");
//                 console.log(instanceList.join("\n"));

//                 // Wait for instances to terminate before proceeding
//                 console.log("Waiting for instances to terminate... (This may take a while)");
//                 for (const i of instanceIds){
//                     await waitUntilInstanceTerminated(
//                         { client: ec2Client, maxWaitTime: 1000 },
//                         { InstanceIds: [i] }
//                     );
//                 }
//             }
//         } catch (caught) {
//             if (
//                 caught instanceof Error &&
//                 caught.name === "InvalidInstanceID.NotFound"
//             ) {
//                 console.warn(`${caught.message}`);
//             } else {
//                 console.error("Error terminating instances:", caught);
//             }
//         }
//     } else {
//         console.log("No instances found to terminate.");
//     }

//     // --- 2. Delete Network Interfaces ---
//     console.log("\nStep 2: Deleting Network Interfaces...");

//     // Get all tagged network interfaces (in case we missed some from the instances)
//     try {
//         const networkInterfacesCommand = new DescribeNetworkInterfacesCommand({
//             Filters: [
//                 {
//                     Name: `tag:${managedTag.Key}`,
//                     Values: [managedTag.Value],
//                 },
//             ],
//         });
//         const networkInterfacesResponse = await ec2Client.send(networkInterfacesCommand);

//         if (networkInterfacesResponse.NetworkInterfaces) {
//             for (const ni of networkInterfacesResponse.NetworkInterfaces) {
//                 if (ni.NetworkInterfaceId && !networkInterfaceIds.includes(ni.NetworkInterfaceId)) {
//                     networkInterfaceIds.push(ni.NetworkInterfaceId);
//                 }
//             }
//         }
//     } catch (error) {
//         console.error("Error fetching network interfaces:", error);
//     }

//     // Delete all network interfaces
//     if (networkInterfaceIds.length > 0) {
//         console.log(`Deleting ${networkInterfaceIds.length} network interfaces...`);

//         for (const niId of networkInterfaceIds) {
//             try {
//                 await ec2Client.send(new DeleteNetworkInterfaceCommand({
//                     NetworkInterfaceId: niId
//                 }));
//                 console.log(`• Deleted network interface: ${niId}`);
//             } catch (error) {
//                 console.error(`Failed to delete network interface ${niId}:`, error);
//             }
//         }
//     } else {
//         console.log("No network interfaces found to delete.");
//     }

//     // --- 3. Release Elastic IPs ---
//     console.log("\nStep 3: Releasing Elastic IPs...");

//     try {
//         // Find Elastic IPs tagged with our managed tag
//         const describeAddressesCommand = new DescribeAddressesCommand({
//             Filters: [
//                 {
//                     Name: `tag:${managedTag.Key}`,
//                     Values: [managedTag.Value],
//                 },
//             ],
//         });

//         const addressesResponse = await ec2Client.send(describeAddressesCommand);

//         if (addressesResponse.Addresses && addressesResponse.Addresses.length > 0) {
//             console.log(`Found ${addressesResponse.Addresses.length} Elastic IPs to release`);

//             for (const address of addressesResponse.Addresses) {
//                 if (address.AllocationId) {
//                     try {
//                         await ec2Client.send(new ReleaseAddressCommand({
//                             AllocationId: address.AllocationId
//                         }));
//                         console.log(`• Released Elastic IP: ${address.PublicIp} (${address.AllocationId})`);
//                     } catch (error) {
//                         console.error(`Failed to release Elastic IP ${address.PublicIp}:`, error);
//                     }
//                 }
//             }
//         } else {
//             console.log("No Elastic IPs found to release.");
//         }
//     } catch (error) {
//         console.error("Error during Elastic IP release:", error);
//     }

//     // --- 4. Delete VPCs and related resources ---
//     console.log("\nStep 4: Deleting VPCs and related resources...");
//     try {
//         // Find VPCs tagged with our managed tag
//         const describeVpcsCommand = new DescribeVpcsCommand({
//             Filters: [
//                 {
//                     Name: `tag:${managedTag.Key}`,
//                     Values: [managedTag.Value],
//                 },
//             ],
//         });
//         const vpcsResponse = await ec2Client.send(describeVpcsCommand);

//         if (vpcsResponse.Vpcs && vpcsResponse.Vpcs.length > 0) {
//             console.log(`Found ${vpcsResponse.Vpcs.length} VPCs to delete`);

//             for (const vpc of vpcsResponse.Vpcs) {
//                 const vpcId = vpc.VpcId;
//                 console.log(`Processing VPC: ${vpcId}`);

//                 // 1. Delete route table associations and route tables
//                 const routeTablesCommand = new DescribeRouteTablesCommand({
//                     Filters: [{ Name: "vpc-id", Values: [vpcId] }]
//                 });
//                 const routeTablesResponse = await ec2Client.send(routeTablesCommand);

//                 if (routeTablesResponse.RouteTables) {
//                     for (const routeTable of routeTablesResponse.RouteTables) {
//                         // Skip the main route table (it will be deleted with the VPC)
//                         if (routeTable.Associations && routeTable.Associations.some(assoc => assoc.Main)) {
//                             console.log(`  • Skipping main route table: ${routeTable.RouteTableId}`);
//                             continue;
//                         }

//                         // Disassociate route table associations
//                         if (routeTable.Associations) {
//                             for (const association of routeTable.Associations) {
//                                 if (association.RouteTableAssociationId) {
//                                     await ec2Client.send(new DisassociateRouteTableCommand({
//                                         AssociationId: association.RouteTableAssociationId
//                                     }));
//                                     console.log(`  • Disassociated route table association: ${association.RouteTableAssociationId}`);
//                                 }
//                             }
//                         }

//                         // Delete route table
//                         await ec2Client.send(new DeleteRouteTableCommand({
//                             RouteTableId: routeTable.RouteTableId
//                         }));
//                         console.log(`  • Deleted route table: ${routeTable.RouteTableId}`);
//                     }
//                 }

//                 // 2. Detach and delete internet gateways
//                 const internetGatewaysCommand = new DescribeInternetGatewaysCommand({
//                     Filters: [{ Name: "attachment.vpc-id", Values: [vpcId] }]
//                 });
//                 const internetGatewaysResponse = await ec2Client.send(internetGatewaysCommand);

//                 if (internetGatewaysResponse.InternetGateways) {
//                     for (const igw of internetGatewaysResponse.InternetGateways) {
//                         // Detach the IGW from the VPC
//                         await ec2Client.send(new DetachInternetGatewayCommand({
//                             InternetGatewayId: igw.InternetGatewayId,
//                             VpcId: vpcId
//                         }));
//                         console.log(`  • Detached internet gateway: ${igw.InternetGatewayId}`);

//                         // Delete the IGW
//                         await ec2Client.send(new DeleteInternetGatewayCommand({
//                             InternetGatewayId: igw.InternetGatewayId
//                         }));
//                         console.log(`  • Deleted internet gateway: ${igw.InternetGatewayId}`);
//                     }
//                 }

//                 // 3. Delete subnets
//                 const subnetsCommand = new DescribeSubnetsCommand({
//                     Filters: [{ Name: "vpc-id", Values: [vpcId] }]
//                 });
//                 const subnetsResponse = await ec2Client.send(subnetsCommand);

//                 if (subnetsResponse.Subnets) {
//                     for (const subnet of subnetsResponse.Subnets) {
//                         await ec2Client.send(new DeleteSubnetCommand({
//                             SubnetId: subnet.SubnetId
//                         }));
//                         console.log(`  • Deleted subnet: ${subnet.SubnetId}`);
//                     }
//                 }

//                 // 4. Delete security groups (except the default one which is deleted with the VPC)
//                 const securityGroupsCommand = new DescribeSecurityGroupsCommand({
//                     Filters: [{ Name: "vpc-id", Values: [vpcId] }]
//                 });
//                 const securityGroupsResponse = await ec2Client.send(securityGroupsCommand);

//                 if (securityGroupsResponse.SecurityGroups) {
//                     for (const sg of securityGroupsResponse.SecurityGroups) {
//                         // Skip default security group
//                         if (sg.GroupName === 'default') {
//                             continue;
//                         }

//                         try {
//                             await ec2Client.send(new DeleteSecurityGroupCommand({
//                                 GroupId: sg.GroupId
//                             }));
//                             console.log(`  • Deleted security group: ${sg.GroupId}`);
//                         } catch (err) {
//                             console.log(`  • Failed to delete security group ${sg.GroupId}, may have dependencies: ${err.message}`);
//                         }
//                     }
//                 }

//                 // 5. Finally delete the VPC
//                 await ec2Client.send(new DeleteVpcCommand({
//                     VpcId: vpcId
//                 }));
//                 console.log(`• Successfully deleted VPC: ${vpcId}`);
//             }
//         } else {
//             console.log("No VPCs found to delete.");
//         }
//     } catch (error) {
//         console.error("Error during VPC deletion:", error);
//     }
//     // --- 5. Delete IAM Role ---
//     console.log("\nStep 5: Deleting IAM Role...");

//     // Get name of managed tag
//     const listCommand = new ListRolesCommand();
//     const listReponse = await iamClient.send(listCommand);

//     // This is inefficient but sadly the only way to get the tags of existing IAM roles
//     // See Docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iam/command/ListRolesCommand/
//     // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iam/command/ListRoleTagsCommand/

//     let managedRoleNames = [];
//     for (const role of listReponse.Roles){
//         const input = { RoleName: role.RoleName }
//         const command = new ListRoleTagsCommand(input);
//         try {
//             const tagResponse = await iamClient.send(command);
//             if (tagResponse.Tags){
//                 for (const t of tagResponse.Tags){
//                     if (t.Key == managedTag.Key && t.Value == managedTag.Value){
//                         managedRoleNames.push(role.RoleName);
//                     }
//                 }
//             }
//         } catch (e) {
//             console.log(`Error Listing Tags of role: ${e}`)
//             console.log("Continuing...")
//         }
//     }

//     // Can be refactored for multiple roles, for now, just uses the first role
//     const roleName = managedRoleNames[0]

//     if(roleName) {
//         // Can be refactored for multiple roles in the future, for now, just use last one
//         try {
//             // First, list and detach all attached managed policies
//             const listAttachedPoliciesCommand = new ListAttachedRolePoliciesCommand({
//                 RoleName: roleName
//             });
//             const attachedPoliciesResponse = await iamClient.send(listAttachedPoliciesCommand);

//             if (attachedPoliciesResponse.AttachedPolicies) {
//                 for (const policy of attachedPoliciesResponse.AttachedPolicies) {
//                     if (policy.PolicyArn) {
//                         await iamClient.send(new DetachRolePolicyCommand({
//                             RoleName: roleName,
//                             PolicyArn: policy.PolicyArn
//                         }));
//                         console.log(`• Detached policy ${policy.PolicyName} from role ${roleName}`);
//                     }
//                 }
//             }

//             // List and delete inline policies
//             const listRolePoliciesCommand = new ListRolePoliciesCommand({
//                 RoleName: roleName
//             });
//             const rolePoliciesResponse = await iamClient.send(listRolePoliciesCommand);

//             if (rolePoliciesResponse.PolicyNames) {
//                 for (const policyName of rolePoliciesResponse.PolicyNames) {
//                     await iamClient.send(new DeleteRolePolicyCommand({
//                         RoleName: roleName,
//                         PolicyName: policyName
//                     }));
//                     console.log(`• Deleted inline policy ${policyName} from role ${roleName}`);
//                 }
//             }

//             // List and delete instance profiles
//             const listInstanceProfieCommand = new ListInstanceProfilesCommand();
//             const roleInstanceProfileResponse = await iamClient.send(listInstanceProfieCommand);

//             if (roleInstanceProfileResponse) {
//                 // Get the matching profile instance for the role
//                 let profileName;
//                 for (const pN of roleInstanceProfileResponse.InstanceProfiles){
//                     if (pN.InstanceProfileName == roleName){
//                         profileName = roleName
//                         break;
//                     }
//                 }
//                 try{
//                     await iamClient.send(new RemoveRoleFromInstanceProfileCommand({
//                         RoleName: roleName,
//                         InstanceProfileName: profileName
//                     }));
//                     await iamClient.send(new DeleteInstanceProfileCommand({
//                         InstanceProfileName: profileName
//                     }));
//                 } catch (e) {
//                     console.error(`Error deleting IAM instance profile ${profileName}:`, e);
//                     console.error("Continuing...");
//                 }
//                 console.log(`• Deleted instance profile ${profileName} from role ${roleName}`);
//             }

//             // Delete the role
//             await iamClient.send(new DeleteRoleCommand({RoleName: roleName}));
//             console.log(`• Successfully deleted role: ${roleName}`);
//         } catch (error) {
//             console.error(`Error deleting IAM role ${roleName}:`, error);
//         }
//     }

//     console.log("\nUniverse destruction process completed.");
// }


// async function editUniverse() {
//     //Prompts user for paramaters
//     const params: YugabyteParams = await resGen.promptForYBParams();
//     // Execute the resource cleanup
//     // Create Tag from params
//     const managedTag = { Key: params.ManagementTagKey, Value: params.ManagementTagValue };
//     destroyUniverse(params.Region, managedTag).catch(err => {
//         console.error("Fatal error during universe destruction:", err);
//         process.exit(1);
//     });
// }

// editUniverse();