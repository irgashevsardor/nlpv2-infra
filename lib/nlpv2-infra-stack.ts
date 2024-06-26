import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as efs from 'aws-cdk-lib/aws-efs'

export class Nlpv2InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Input Storing SQS Queue
    const inputQueue = new sqs.Queue(this, 'NlpSqsQueue', {
      visibilityTimeout: cdk.Duration.seconds(300)
    });

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      // subnetConfiguration: [
      //   {
      //     cidrMask: 24,
      //     name: 'NlpPrivateSubnet',
      //     subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      //   }
      // ]
    });
    const cluster = new ecs.Cluster(this, 'EcsCluster', { vpc });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'NlpTaskDef')
    taskDefinition.addContainer('nlpv2', {
      image: ecs.ContainerImage.fromRegistry('nlpv2'),
      environment: {
        // SQS_QUEUE_URL: queue.queueUrl,
        // EFS_MOUNT_PATH: '/mnt/efs',
      },
    })

    const queueProcessingFargateService = new ecsPatterns.QueueProcessingFargateService(this, 'NlpFargateService', {
      cluster: cluster,
      queue: inputQueue,
      cpu: 4096,
      memoryLimitMiB: 1024,
      serviceName: 'NlpFargateService',
      taskDefinition: taskDefinition
    })

    const fileSystem = new efs.FileSystem(this, 'MyEfsFileSystem', {
      vpc: vpc,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS, // files are not transitioned to infrequent access (IA) storage by default
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE, // default
      outOfInfrequentAccessPolicy: efs.OutOfInfrequentAccessPolicy.AFTER_1_ACCESS, // files are not transitioned back from (infrequent access) IA to primary storage by default
      transitionToArchivePolicy: efs.LifecyclePolicy.AFTER_14_DAYS, // files are not transitioned to Archive by default
      replicationOverwriteProtection: efs.ReplicationOverwriteProtection.ENABLED, // Set to `DISABLED` if you want to create a read-only file system for use as a replication destination
    });
  }
}
