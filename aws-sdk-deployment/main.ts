import { PlacementInfo, YugabyteParams } from "./types";
import * as resGen from "./resource-generator";
import { DescribeRegionsCommand, EC2Client } from "@aws-sdk/client-ec2";
import inquirer from "inquirer";
import { deployMultiRegion } from "./multi-region-deployment";
import { deployMultiAZ } from "./multi-az-deployment";
async function createUniverse() {
  const DEPLOYMENT_TYPES = ["Multi-AZ", "Single-Server", "Multi-Region"];
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "DeploymentType",
      message: "Select Deployment Type",
      choices: DEPLOYMENT_TYPES,
      default: DEPLOYMENT_TYPES[0]
    },
  ]);

  if(answers.DeploymentType === "Multi-AZ"){
        await deployMultiAZ();}
  else if(answers.DeploymentType === "Multi-Region"){
        await deployMultiRegion();}
    //add single later
  
}

createUniverse();
