const AWS = require("aws-sdk");
const AWSXRay = require("aws-xray-sdk-core");
const { createVariableStatement } = require("typescript");

const xRay = AWSXRay.captureAWS(require("aws-sdk"));

const awsRegion = process.env.AWS_REGION;
const eventsDdb = process.env.EVENTS_DDB;

AWS.config.update({
  region: awsRegion,
});

const ddbClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async function (event, context) {
  console.log(event);

  const promises = [];

  event.Records.forEach((record) => {
    console.log(record);

    //record.dynamodb.Keys.pk.S
    if (record.eventName === "INSERT") {
      console.log(`NewImage pk.s: ${record.dynamodb.NewImage.pk.S}`);
      if (record.dynamodb.NewImage.pk.S.startsWith("#transaction")) {
        //Invoice transaction event
        console.log(`Invoice transaction event received`);
      } else {
        //Invoice event
        console.log(`Invoice event received`);
        promises.push(createEvent(record.dynamodb.NewImage, "INVOICE_CREATED"));
      }
    } else if (record.eventName === "MODIFY") {
    } else if (record.eventName === "REMOVE") {
      if (record.dynamodb.OldImage.pk.S.startsWith("#transaction")) {
        //Invoice transaction event
        console.log(`Invoice transaction event received`);
        if (
          record.dynamodb.OldImage.transactionStatus.S === "INVOICE_PROCESSED"
        ) {
          console.log("Invoice processed");
        } else {
          console.log("Invoice import failed - timeout / error");
        }
      }
    }
  });

  await Promise.all(promises);

  return {};
};

function createEvent(invoiceEvent, eventType) {
  const timestamp = Date.now();
  const ttl = ~~(timestamp / 1000 + 60 * 60);

  const params = {
    TableName: eventsDdb,
    Item: {
      pk: `#invoice_${invoiceEvent.sk.S}`, // #invoice_ABC-123
      sk: `${eventType}#${timestamp}`, // INVOICE_CREATED#123
      ttl: ttl,
      username: invoiceEvent.pk.S.split("_")[1],
      createdAt: timestamp,
      eventType: eventType,
      info: {
        transactionId: invoiceEvent.transactionId.S,
        productId: invoiceEvent.productId.N,
      },
    },
  };

  try {
    return ddbClient.put(params).promise();
  } catch (err) {
    console.error(err);
  }
}
