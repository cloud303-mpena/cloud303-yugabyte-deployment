import {
    DescribeInstancesCommand,
    EC2Client,
    TerminateInstancesCommand,
    DeleteNetworkInterfaceCommand,
    DescribeNetworkInterfacesCommand,
    ReleaseAddressCommand,
    DescribeAddressesCommand,
    Tag, waitUntilInstanceRunning, waitUntilInstanceTerminated,
} from "@aws-sdk/client-ec2";
import {
    IAMClient,
    DeleteRoleCommand,
    ListRolePoliciesCommand,
    DetachRolePolicyCommand,
    DeleteRolePolicyCommand,
    ListAttachedRolePoliciesCommand,
    ListRolesCommand,
    ListRoleTagsCommand
} from "@aws-sdk/client-iam";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const managedTag = { Key: "c303-yugabyte-managed", Value: "true" };
const managedTagType: Tag = {
    Key: "c303-yugabyte-managed",
    Value: "true",
}


/**
 * Delete resources in the specified order:
 * 1. Terminate EC2 Instances
 * 2. Delete Network Interfaces
 * 3. Release Elastic IPs
 * 4. Delete Role
 */
async function destroyUniverse() {
    const ec2Client = new EC2Client({ region: "us-east-1" });
    const iamClient = new IAMClient({ region: "us-east-1" });

    // --- 1. Terminate EC2 instances ---
    console.log("Step 1: Terminating EC2 instances...");

    // Get EC2 instances that are tagged as managed
    const taggedInput = {
        Filters: [
            {
                Name: "tag:c303-yugabyte-managed",
                Values: ["true"],
            },
        ],
    };

    const describeCommand = new DescribeInstancesCommand(taggedInput);
    const response = await ec2Client.send(describeCommand);
    let instanceIds = [];
    let networkInterfaceIds = [];

    // Check if Reservations exists and is an array
    if (response.Reservations && Array.isArray(response.Reservations)) {
        for (const reservation of response.Reservations) {
            if (reservation.Instances && Array.isArray(reservation.Instances)) {
                for (const instance of reservation.Instances) {
                    // Check if InstanceId exists on the instance object
                    if (instance.InstanceId) {
                        instanceIds.push(instance.InstanceId);
                    }

                    // Collect network interface IDs
                    if (instance.NetworkInterfaces) {
                        for (const netInterface of instance.NetworkInterfaces) {
                            if (netInterface.NetworkInterfaceId) {
                                networkInterfaceIds.push(netInterface.NetworkInterfaceId);
                            }
                        }
                    }
                }
            }
        }
    }

    // Terminate instances if any were found
    if (instanceIds.length > 0) {
        try {
            const command = new TerminateInstancesCommand({ InstanceIds: instanceIds });
            const { TerminatingInstances } = await ec2Client.send(command);

            if (TerminatingInstances) {
                const instanceList = TerminatingInstances.map(
                    (instance) => `• ${instance.InstanceId}`
                );
                console.log("Terminating instances:");
                console.log(instanceList.join("\n"));

                // Wait for instances to terminate before proceeding
                console.log("Waiting for instances to terminate...");
                for (const i of instanceIds){
                    await waitUntilInstanceTerminated(
                        { client: ec2Client, maxWaitTime: 1000 },
                        { InstanceIds: [i] }
                    );
                }
            }
        } catch (caught) {
            if (
                caught instanceof Error &&
                caught.name === "InvalidInstanceID.NotFound"
            ) {
                console.warn(`${caught.message}`);
            } else {
                console.error("Error terminating instances:", caught);
            }
        }
    } else {
        console.log("No instances found to terminate.");
    }

    // --- 2. Delete Network Interfaces ---
    console.log("\nStep 2: Deleting Network Interfaces...");

    // Get all tagged network interfaces (in case we missed some from the instances)
    try {
        const networkInterfacesCommand = new DescribeNetworkInterfacesCommand({
            Filters: [
                {
                    Name: "tag:c303-yugabyte-managed",
                    Values: ["true"],
                },
            ],
        });
        const networkInterfacesResponse = await ec2Client.send(networkInterfacesCommand);

        if (networkInterfacesResponse.NetworkInterfaces) {
            for (const ni of networkInterfacesResponse.NetworkInterfaces) {
                if (ni.NetworkInterfaceId && !networkInterfaceIds.includes(ni.NetworkInterfaceId)) {
                    networkInterfaceIds.push(ni.NetworkInterfaceId);
                }
            }
        }
    } catch (error) {
        console.error("Error fetching network interfaces:", error);
    }

    // Delete all network interfaces
    if (networkInterfaceIds.length > 0) {
        console.log(`Deleting ${networkInterfaceIds.length} network interfaces...`);

        for (const niId of networkInterfaceIds) {
            try {
                await ec2Client.send(new DeleteNetworkInterfaceCommand({
                    NetworkInterfaceId: niId
                }));
                console.log(`• Deleted network interface: ${niId}`);
            } catch (error) {
                console.error(`Failed to delete network interface ${niId}:`, error);
            }
        }
    } else {
        console.log("No network interfaces found to delete.");
    }

    // --- 3. Release Elastic IPs ---
    console.log("\nStep 3: Releasing Elastic IPs...");

    try {
        // Find Elastic IPs tagged with our managed tag
        const describeAddressesCommand = new DescribeAddressesCommand({
            Filters: [
                {
                    Name: "tag:c303-yugabyte-managed",
                    Values: ["true"],
                },
            ],
        });

        const addressesResponse = await ec2Client.send(describeAddressesCommand);

        if (addressesResponse.Addresses && addressesResponse.Addresses.length > 0) {
            console.log(`Found ${addressesResponse.Addresses.length} Elastic IPs to release`);

            for (const address of addressesResponse.Addresses) {
                if (address.AllocationId) {
                    try {
                        await ec2Client.send(new ReleaseAddressCommand({
                            AllocationId: address.AllocationId
                        }));
                        console.log(`• Released Elastic IP: ${address.PublicIp} (${address.AllocationId})`);
                    } catch (error) {
                        console.error(`Failed to release Elastic IP ${address.PublicIp}:`, error);
                    }
                }
            }
        } else {
            console.log("No Elastic IPs found to release.");
        }
    } catch (error) {
        console.error("Error during Elastic IP release:", error);
    }

    // --- 4. Delete IAM Role ---
    console.log("\nStep 4: Deleting IAM Role...");

    // Get name of managed tag
    const listCommand = new ListRolesCommand();
    const listReponse = await iamClient.send(listCommand);

    // This is inefficient but sadly the only way to get the tags of existing IAM roles
    // See Docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iam/command/ListRolesCommand/
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iam/command/ListRoleTagsCommand/

    let managedRoleNames = [];
    for (const role of listReponse.Roles){
        const input = { RoleName: role.RoleName }
        const command = new ListRoleTagsCommand(input);
        try {
            const tagResponse = await iamClient.send(command);
            if (tagResponse.Tags){
                for (const t of tagResponse.Tags){
                    if (t.Key == managedTag.Key && t.Value == managedTag.Value){
                        managedRoleNames.push(role.RoleName);
                    }
                }
            }
        } catch (e) {
            console.log(`Error Listing Tags of role: ${e}`)
            console.log("Continuing...")
        }
    }

    // Can be refactored for multiple roles, for now, just uses the first role
    const roleName = managedRoleNames[0]

    if(roleName) {
        // Can be refactored for multiple roles in the future, for now, just use last one
        try {
            // First, list and detach all attached managed policies
            const listAttachedPoliciesCommand = new ListAttachedRolePoliciesCommand({
                RoleName: roleName
            });
            const attachedPoliciesResponse = await iamClient.send(listAttachedPoliciesCommand);

            if (attachedPoliciesResponse.AttachedPolicies) {
                for (const policy of attachedPoliciesResponse.AttachedPolicies) {
                    if (policy.PolicyArn) {
                        await iamClient.send(new DetachRolePolicyCommand({
                            RoleName: roleName,
                            PolicyArn: policy.PolicyArn
                        }));
                        console.log(`• Detached policy ${policy.PolicyName} from role ${roleName}`);
                    }
                }
            }

            // List and delete inline policies
            const listRolePoliciesCommand = new ListRolePoliciesCommand({
                RoleName: roleName
            });
            const rolePoliciesResponse = await iamClient.send(listRolePoliciesCommand);

            if (rolePoliciesResponse.PolicyNames) {
                for (const policyName of rolePoliciesResponse.PolicyNames) {
                    await iamClient.send(new DeleteRolePolicyCommand({
                        RoleName: roleName,
                        PolicyName: policyName
                    }));
                    console.log(`• Deleted inline policy ${policyName} from role ${roleName}`);
                }
            }

            // Delete the role
            await iamClient.send(new DeleteRoleCommand({RoleName: roleName}));
            console.log(`• Successfully deleted role: ${roleName}`);
        } catch (error) {
            console.error(`Error deleting IAM role ${roleName}:`, error);
        }
    }

    console.log("\nUniverse destruction process completed.");
}

// Execute the resource cleanup
destroyUniverse().catch(err => {
    console.error("Fatal error during universe destruction:", err);
    process.exit(1);
});