import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as efs from 'aws-cdk-lib/aws-efs'
import * as ecr from 'aws-cdk-lib/aws-ecr'

export class Nlpv2InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });
    const cluster = new ecs.Cluster(this, 'EcsCluster', { vpc });

    const inputQueue = new sqs.Queue(this, 'NlpSqsQueue', {
      visibilityTimeout: cdk.Duration.seconds(300)
    });

    const fileSystem = new efs.FileSystem(this, 'NlpV2EfsFileSystem', {
      vpc: vpc,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS, // files are not transitioned to infrequent access (IA) storage by default
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE, // default
      outOfInfrequentAccessPolicy: efs.OutOfInfrequentAccessPolicy.AFTER_1_ACCESS, // files are not transitioned back from (infrequent access) IA to primary storage by default
      replicationOverwriteProtection: efs.ReplicationOverwriteProtection.ENABLED, // Set to `DISABLED` if you want to create a read-only file system for use as a replication destination
    });

    const repository = new ecr.Repository(this, 'NlpV2Repo', {
      repositoryName: 'nlpv2repo'
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'NlpTaskDef', {
      cpu: 8192,
      memoryLimitMiB: 16384
    })

    const volumeName = 'efs-volume'
    taskDefinition.addVolume({
      name: volumeName,
      efsVolumeConfiguration: {
        fileSystemId: fileSystem.fileSystemId
      }
    })

    const container = taskDefinition.addContainer('nlpv2', {
      image: ecs.ContainerImage.fromEcrRepository(
        repository),
      logging: ecs.LogDriver.awsLogs({ streamPrefix: 'nlpv2' })
    })

    container.addMountPoints({
      containerPath: '/mnt/efs',
      readOnly: false,
      sourceVolume: volumeName
    })

    new ecsPatterns.QueueProcessingFargateService(this, 'NlpFargateService', {
      cluster: cluster,
      queue: inputQueue,
      cpu: 4096,
      memoryLimitMiB: 1024,
      serviceName: 'NlpFargateService',
      taskDefinition: taskDefinition
    })

    new cdk.CfnOutput(this, 'SqsUrl', {
      value: inputQueue.queueUrl,
    })

    new cdk.CfnOutput(this, 'FileSystemId', {
      value: fileSystem.fileSystemId
    })
  }
}
