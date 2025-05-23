import {DescribeInstancesCommand, EC2Client, Filter, Tag, TerminateInstancesCommand,
} from "@aws-sdk/client-ec2";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const managedTag = { Key: "c303-yugabyte-managed", Value: "true", };

const managedTagType: Tag = {
    Key: "c303-yugabyte-managed",
    Value: "true",
}
/**
 * Terminate one or more EC2 instances.
 * @param {{ instanceIds: string[] }} options
 */
async function destroyUniverse() {
    const client = new EC2Client({ region: "us-east-1"});
    // Get EC2 instances that are tagged as managed
    const taggedInput = {
        Filters: [
            {
                Name: "tag:c303-yugabyte-managed",
                Values: ['true'],
            },
        ],
    };

    const describeCommand = new DescribeInstancesCommand(taggedInput)
    const response = await client.send(describeCommand);

    let instanceIds: string[] = new Array<string>();

    // Check if Reservations exists and is an array
    if (response.Reservations && Array.isArray(response.Reservations)) {
        for (const reservation /*: Reservation*/ of response.Reservations) {
            // console.log(`Reservation ID: ${reservation.ReservationId}`); // You can log the actual ReservationId

            // Check if Instances exists within this reservation and is an array
            if (reservation.Instances && Array.isArray(reservation.Instances)) {
                for (const instance /*: Instance*/ of reservation.Instances) {
                    // Check if InstanceId exists on the instance object
                    if (instance.InstanceId) {
                        instanceIds.push(instance.InstanceId);
                    }
                }
            }
        }
    }

    try {
        const command = new TerminateInstancesCommand({ InstanceIds: instanceIds })
        const { TerminatingInstances } = await client.send(command);
        const instanceList = TerminatingInstances.map(
            (instance) => ` • ${instance.InstanceId}`,
        );
        console.log("Terminating instances:");
        console.log(instanceList.join("\n"));
    } catch (caught) {
        if (
            caught instanceof Error &&
            caught.name === "InvalidInstanceID.NotFound"
        ) {
            console.warn(`${caught.message}`);
        } else {
            throw caught;
        }
    }
};


destroyUniverse();