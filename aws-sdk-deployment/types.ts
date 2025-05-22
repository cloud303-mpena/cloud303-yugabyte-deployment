export interface YugabyteParams {
    DBVersion: string;
    RFFactor: number;
    NumberOfNodes;
    KeyName: string;
    InstanceType: string;
    LatestAmiId: string;
    SshUser: string;
    DeploymentType: string;
    Region: string;
  }