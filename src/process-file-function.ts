import { APIGatewayEvent } from 'aws-lambda';
import { fileTypeFromBuffer } from 'file-type';

export const handler = async (event: APIGatewayEvent) => {
  console.log('process-file-function:event', event);

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
