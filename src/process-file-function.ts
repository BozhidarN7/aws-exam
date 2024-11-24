import { APIGatewayEvent } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { fileTypeFromBuffer } from 'file-type';
import { v4 } from 'uuid';

const snsClient = new SNSClient({});
const dynamodbClient = new DynamoDBClient({});

export const handler = async (event: APIGatewayEvent) => {
  console.log('process-file-function:event', event);

  const tableName = process.env.TABLE_NAME || '';
  const topicArn = process.env.TOPIC_ARN || '';

  try {
    const { body, isBase64Encoded, headers } = event;

    if (!body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'No file uploaded' }),
      };
    }

    const fileBuffer = isBase64Encoded ? Buffer.from(body, 'base64') : Buffer.from(body, 'utf-8');
    const fileType = await fileTypeFromBuffer(fileBuffer);

    const fileSize = fileBuffer.byteLength;
    const extension = fileType?.ext || 'unknown';
    const fileName = headers['x-file-name'] || 'unknown';

    if (!['pdf', 'jpg', 'png', 'jpeg'].includes(extension)) {
      await sendEmailMessage(
        snsClient,
        topicArn,
        `There was a problem with uploading your file: ${fileName}. Please only try to upload files in the following formats: pdf, jpg, and png.`,
      );

      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Unsupported file type', extension }),
      };
    }

    const uploadDate = new Date(Date.now()).toString();
    await storeFileInDb(dynamodbClient, tableName, {
      fileSize: fileSize.toString(),
      extension: extension.toString(),
      uploadDate,
    });

    await sendEmailMessage(
      snsClient,
      topicArn,
      `Your file has been successfully uploaded. File info: file extension - ${extension}, file size - ${fileSize} (in bytes), saved on - ${uploadDate}`,
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'File processed successfully',
        fileName,
        extension,
        fileSize, // in bytes
      }),
    };
  } catch (error) {
    console.log('process-file-function: error', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: (error as Error).message }),
    };
  }
};

const storeFileInDb = async (
  dynamodbClient: DynamoDBClient,
  tableName: string,
  data: { extension: string; fileSize: string; uploadDate: string },
) => {
  const { extension, fileSize, uploadDate } = data;
  const ttl = Math.floor(Date.now() / 1000) * 30 * 60;

  await dynamodbClient.send(
    new PutItemCommand({
      TableName: tableName,
      Item: {
        id: {
          S: v4(),
        },
        fileSize: {
          N: fileSize,
        },
        fileExtension: {
          S: extension,
        },
        uploadDate: {
          S: uploadDate,
        },
        ttl: {
          N: ttl.toString(),
        },
      },
    }),
  );
};

const sendEmailMessage = async (snsClient: SNSClient, topicArn: string, message: string) => {
  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: message,
    }),
  );
};
