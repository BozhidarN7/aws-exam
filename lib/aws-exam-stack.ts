import * as cdk from 'aws-cdk-lib';
import { ProjectionType } from 'aws-cdk-lib/aws-dynamodb';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { FilterCriteria, FilterRule, Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Subscription, SubscriptionProtocol, Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class AwsExamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const filesTable = new Table(this, 'FilesTable', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    filesTable.addGlobalSecondaryIndex({
      indexName: 'ExtensionIndexNew',
      partitionKey: {
        name: 'fileExtension',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    const filesTopic = new Topic(this, 'FilesTopic', {
      topicName: 'FilesTopic',
    });

    new Subscription(this, 'FilesSubscription', {
      topic: filesTopic,
      protocol: SubscriptionProtocol.EMAIL,
      endpoint: 'bojonemski@gmail.com',
    });

    const processFileFunction = new NodejsFunction(this, 'processFunction', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: `${__dirname}/../src/process-file-function.ts`,
      environment: {
        TABLE_NAME: filesTable.tableName,
        TOPIC_ARN: filesTopic.topicArn,
      },
    });

    const getAllFilesByGivenExtentionFunction = new NodejsFunction(
      this,
      'getAllFilesByGivenExtensionFunction',
      {
        runtime: Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: `${__dirname}/../src/get-all-files-by-given-extension-function.ts`,
        environment: {
          TABLE_NAME: filesTable.tableName,
        },
      },
    );

    const cleanupFunction = new NodejsFunction(this, 'cleanupFunction', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: `${__dirname}/../src/file-cleanup-function.ts`,
      environment: {
        TABLE_NAME: filesTable.tableName,
        TOPIC_ARN: filesTopic.topicArn,
      },
    });

    filesTable.grantReadWriteData(processFileFunction);
    filesTopic.grantPublish(processFileFunction);

    filesTable.grantReadWriteData(cleanupFunction);
    filesTopic.grantPublish(cleanupFunction);

    filesTable.grantReadWriteData(getAllFilesByGivenExtentionFunction);

    cleanupFunction.addEventSource(
      new DynamoEventSource(filesTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: 5,
        filters: [FilterCriteria.filter({ eventName: FilterRule.isEqual('REMOVE') })],
      }),
    );

    const api = new RestApi(this, 'ProcesssFilesApi', {
      binaryMediaTypes: ['*/*'],
    });
    const resource = api.root.addResource('processFile');
    resource.addMethod('POST', new LambdaIntegration(processFileFunction));
    resource.addMethod('GET', new LambdaIntegration(getAllFilesByGivenExtentionFunction));
    resource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['POST'],
    });

    new cdk.CfnOutput(this, 'RESTApiEndpoint', {
      value: api.url,
    });
  }
}
