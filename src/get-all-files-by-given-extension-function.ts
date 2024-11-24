import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { APIGatewayEvent } from 'aws-lambda';

const dynamodbClient = new DynamoDBClient({});

export const handler = async (event: APIGatewayEvent) => {
  console.log('get-all-files-function', event);
  const tableName = process.env.TABLE_NAME || '';
  const fileExtension = event.queryStringParameters?.extension;

  if (!fileExtension) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing file extension query parameter' }),
    };
  }

  try {
    const params = {
      TableName: tableName,
      IndexName: 'ExtensionIndexNew',
      KeyConditionExpression: 'fileExtension = :fileExtension',
      ExpressionAttributeValues: {
        ':fileExtension': { S: fileExtension },
      },
    };

    const command = new QueryCommand(params);

    const result = await dynamodbClient.send(command);

    // Check if any files were found
    const files = result.Items;

    if (files && files.length > 0) {
      return {
        statusCode: 200,
        body: JSON.stringify(files),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'No files found for the given extension' }),
      };
    }
  } catch (error) {
    console.error('Error querying DynamoDB:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: (error as Error).message }),
    };
  }
};
