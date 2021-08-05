const AWS = require("aws-sdk");
const AWSXRay = require("aws-xray-sdk-core");

const xRay = AWSXRay.captureAWS(require("aws-sdk"));

const eventsDdb = process.env.EVENTS_DDB;
const awsRegion = process.env.AWS_REGION;

AWS.config.update({
  region: awsRegion,
});

const ddbClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async function (event, context) {
  console.log(event);

  const promises = [];

  event.Records.forEach((record) => {
    const body = JSON.parse(record.body);
    console.log(body);
    promises.push(createEvent(body));
  });

  await Promise.all(promises);

  return {};
};

function createEvent(body) {
  const envelope = JSON.parse(body.Message);
  const event = JSON.parse(envelope.data);

  console.log(`MessageId: ${body.MessageId}`);

  const timestamp = Date.now();
  const ttl = ~~(timestamp / 1000 + 60 * 60);

  try {
    return ddbClient
      .put({
        TableName: eventsDdb,
        Item: {
          pk: `#order_${event.orderId}`,
          sk: `${envelope.eventType}#${timestamp}`,
          ttl: ttl,
          username: event.username,
          createdAt: timestamp,
          requestId: event.requestId,
          eventType: envelope.eventType,
          info: {
            orderId: event.orderId,
            productCodes: event.productCodes,
            messageId: body.MessageId,
          },
        },
      })
      .promise();
  } catch (err) {
    console.error(err);
  }
}
