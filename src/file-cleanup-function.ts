import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { DynamoDBStreamEvent } from 'aws-lambda';

const snsClient = new SNSClient({});

export const handler = async (event: DynamoDBStreamEvent) => {
  console.log('file-cleanup-function:event', event);

  const topicArn = process.env.TOPIC_ARN;

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: `File with key ${event.Records[0].dynamodb?.Keys?.id?.S} was deleted successfully`,
    }),
  );

  return {
    statusCode: 200,
    body: 'Hi from lambda',
  };
};
