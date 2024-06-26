import * as cdk from 'aws-cdk-lib'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as efs from 'aws-cdk-lib/aws-efs'
import * as elasticache from 'aws-cdk-lib/aws-elasticache'
// import * as iam from 'aws-cdk-lib/aws-iam'
// import * as logs from 'aws-cdk-lib/aws-logs'


export class Nlpv2Stack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // Create the ECS Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'Nlpv2TaskDef');

    // Add container to the task definition
    const container = taskDefinition.addContainer('Nlpv2Container', {
      image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      memoryLimitMiB: 512,
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'nlp-service',
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        SQS_QUEUE_URL: queue.queueUrl,
        EFS_MOUNT_PATH: '/mnt/efs',
      },
    });

    // Add EFS volume to the task definition
    const volumeName = "nlpEfsVolume";
    taskDefinition.addVolume({
      name: volumeName,
      efsVolumeConfiguration: {
        fileSystemId: fileSystem.fileSystemId,
      },
    });

    container.addMountPoints({
      sourceVolume: volumeName,
      containerPath: '/mnt/efs',
      readOnly: false,
    });

    // Grant the ECS task role access to the SQS queue and EFS file system
    taskDefinition.taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
      resources: [queue.queueArn],
    }));

    taskDefinition.taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ['elasticfilesystem:ClientWrite', 'elasticfilesystem:ClientMount'],
      resources: [fileSystem.fileSystemArn],
    }));


    // Output the SQS Queue URL
    new cdk.CfnOutput(this, 'QueueURL', {
      value: queue.queueUrl,
    });

    new cdk.CfnOutput(this, 'IndexerQueueURL', {
      value: indexerQueue.queueUrl,
    });

    // Output the EFS File System ID
    new cdk.CfnOutput(this, 'FileSystemID', {
      value: fileSystem.fileSystemId,
    });

    // Output the ElastiCache Endpoint
    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: `${redisCluster.attrRedisEndpointAddress}:${redisCluster.attrRedisEndpointPort}`,
    });
  }
}