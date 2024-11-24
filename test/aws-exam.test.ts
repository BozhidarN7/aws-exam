import * as cdk from 'aws-cdk-lib';
import { AwsExamStack } from '../lib/aws-exam-stack';
import 'jest-cdk-snapshot';

test('SQS Queue Created', () => {
  const app = new cdk.App();
  const stack = new AwsExamStack(app, 'MyTestStack');
  expect(stack).toMatchCdkSnapshot();
});
