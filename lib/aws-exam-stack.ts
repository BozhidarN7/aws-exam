import * as cdk from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class AwsExamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const processFileFunction = new NodejsFunction(this, 'processFunction', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: `${__dirname}/../src/process-file-function.ts`,
    });

    const api = new RestApi(this, 'ProcesssFilesApi', {
      binaryMediaTypes: ['*/*'],
    });
    const resource = api.root.addResource('processFile');
    resource.addMethod('POST', new LambdaIntegration(processFileFunction));
    resource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['POST'],
    });

    new cdk.CfnOutput(this, 'RESTApiEndpoint', {
      value: api.url,
    });
  }
}
