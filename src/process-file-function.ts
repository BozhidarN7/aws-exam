import { APIGatewayEvent } from 'aws-lambda';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { fileTypeFromBuffer } from 'file-type';

const snsClient = new SNSClient({});

export const handler = async (event: APIGatewayEvent) => {
  console.log('process-file-function:event', event);

  const topicArn = process.env.TOPIC_ARN;

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
      await snsClient.send(
        new PublishCommand({
          TopicArn: topicArn,
          Message: `There was a problem with uploading your file: ${fileName}. Please only try to upload files in the following formats: pdf, jpg, and png.`,
        }),
      );

      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Unsupported file type', extension }),
      };
    }

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
