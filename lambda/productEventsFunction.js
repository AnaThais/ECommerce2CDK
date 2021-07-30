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

    await createEvent(event.productEvent);

    console.log(`Product event created, productId: ${event.productEvent.productId}, requestId: ${event.productEvent.requestId}`)

    context.succeed(JSON.stringify({
        productEventCreated: true,
        message: "OK",
    }));
};

function createEvent(productEvent) {
    const timestamp = Date.now();
    const ttl = ~~(timestamp / 1000 + (60 * 60)) // 1 hora no futuro
    const params = {
        TableName: eventsDdb,
        Item: {
            pk: `#product_${productEvent.productCode}`,
            sk: `${productEvent.eventType}#${timestamp}`,
            ttl: ttl,
            username: productEvent.username,
            createdAt: timestamp,
            requestId: productEvent.requestId,
            eventType: productEvent.eventType,
            productId: productEvent.productId,
        }
    };
    try {
        return ddbClient.put(params).promise();
    } catch (err) {
        console.log(err);
    }
}