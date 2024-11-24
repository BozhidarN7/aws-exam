import { PublishCommand } from '@aws-sdk/client-sns';
import { handler } from '../../src/file-cleanup-function'; // Import the actual snsClient instance
import { DynamoDBStreamEvent } from 'aws-lambda';

jest.mock('@aws-sdk/client-sns', () => {
  const mockSend = jest.fn();
  return {
    SNSClient: jest.fn(() => ({
      send: mockSend,
    })),
    PublishCommand: jest.fn(),
    __mockSend: mockSend, // Expose the mock function for assertions
  };
});

describe('Lambda Function', () => {
  let mockSend: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Get the mocked send function
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const snsModule = require('@aws-sdk/client-sns');
    mockSend = snsModule.__mockSend;

    // Set environment variables
    process.env.TOPIC_ARN = 'arn:aws:sns:region:123456789012:MyTopic';
  });

  it('should publish a message to SNS when an item is deleted', async () => {
    const mockEvent = {
      Records: [
        {
          dynamodb: {
            Keys: {
              id: { S: '12345' },
            },
          },
        },
      ],
    } as unknown as DynamoDBStreamEvent;

    // Simulate successful send
    mockSend.mockResolvedValueOnce({});

    // Call the Lambda handler
    const result = await handler(mockEvent);

    // Validate the mocked send method was called
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      new PublishCommand({
        TopicArn: 'arn:aws:sns:region:123456789012:MyTopic',
        Message: 'Delted an item with key id 12345',
      }),
    );

    // Validate the Lambda's response
    expect(result).toEqual({
      statusCode: 200,
      body: 'Hi from lambda',
    });
  });

  it('should handle missing keys gracefully', async () => {
    const mockEvent = {
      Records: [
        {
          dynamodb: {},
        },
      ],
    } as unknown as DynamoDBStreamEvent;

    // Simulate successful send
    mockSend.mockResolvedValueOnce({});

    // Call the Lambda handler
    const result = await handler(mockEvent);

    // Validate the mocked send method was called
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      new PublishCommand({
        TopicArn: 'arn:aws:sns:region:123456789012:MyTopic',
        Message: 'Delted an item with key id undefined',
      }),
    );

    // Validate the Lambda's response
    expect(result).toEqual({
      statusCode: 200,
      body: 'Hi from lambda',
    });
  });
});
