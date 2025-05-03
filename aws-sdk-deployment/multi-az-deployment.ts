import * as resGen from './resource-generator'
import {YugabyteParams} from './types'

async function generateYugabyteStack(): Promise<string>{
    const params: YugabyteParams = await resGen.promptForParams();
    
    const vpcId = await resGen.createVpc("10.0.0.0/16", "Yugabyte VPC")


//TODO: CHANGE THIS TO DO BY REGION LATER
    let azToCidr: { [az: string]: string } = {}
    if (params.RFFactor === 3) {
        azToCidr = {
          "us-east-1a": "10.0.0.0/24",
          "us-east-1b": "10.0.1.0/24",
          "us-east-1c": "10.0.2.0/24"
        };
      } else if (params.RFFactor === 5) {
        azToCidr = {
          "us-east-1a": "10.0.0.0/24",
          "us-east-1b": "10.0.1.0/24",
          "us-east-1c": "10.0.2.0/24",
          "us-east-1d": "10.0.3.0/24",
          "us-east-1e": "10.0.4.0/24"
        };
      }
    const subnetIds = await resGen.createSubnets(vpcId!, azToCidr)

    const intIdAndRouteTableId = await resGen.createInternetGatewayAndRouteTable(vpcId!)

    const associationResponse = await resGen.createSubnetRouteTableAssociations(subnetIds, intIdAndRouteTableId.routeTableId)

    const securityGroupId = await resGen.createYugaByteSecurityGroup(vpcId!, "10.0.0.0/16")

    let netIntIds: string[] = [];
    for (const subnetId of subnetIds) {
      let currNetIntId = await resGen.createNetworkInterface(subnetId, securityGroupId);
      netIntIds.push(currNetIntId);
    }

    const azs = Object.keys(azToCidr);

    for(let i = 0; i < params.RFFactor; i++){
        resGen.createEC2Instance(
            'us-east-1',
            params.InstanceType,
            params.LatestAmiId,
            params.KeyName,
            securityGroupId,
            netIntIds[i],
            true,
            netIntIds,
            azs[i]
        )
    }
    return ""
}

generateYugabyteStack()