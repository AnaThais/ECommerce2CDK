const AWS = require("aws-sdk");
const AWSXRay = require("aws-xray-sdk-core");
const uuid = require("uuid");

const xRay = AWSXRay.captureAWS(require("aws-sdk"));

const awsRegion = process.env.AWS_REGION;
const bucketName = process.env.BUCKET_NAME;
const invoicesDdb = process.env.INVOICES_DDB;

AWS.config.update({
  region: awsRegion,
});

const s3 = new AWS.S3({
  region: awsRegion,
});

const ddbClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async function (event, context) {
  const method = event.httpMethod;

  const apiRequestId = event.requestContext.requestId;
  const lambdaRequestId = context.awsRequestId;

  console.log(
    `API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`
  );

  if (method === "POST") {
    //Generating URL
    const key = uuid.v4();
    const expires = 300;

    const params = {
      Bucket: bucketName,
      Key: key,
      Expires: expires,
    };
    const signedUrl = await s3.getSignedUrlPromise("putObject", params);

    await createInvoiceTransaction(key, lambdaRequestId, expires);

    return {
      statusCode: 200,
      body: JSON.stringify({
        url: signedUrl,
        expiresIn: expires,
        transactionId: key,
      }),
    };
  } else if (method === "GET") {
    if (
      event.queryStringParameters &&
      event.queryStringParameters.transactionId
    ) {
      const transactionId = event.queryStringParameters.transactionId;
      const data = await getInvoiceTransaction(transactionId);

      if (data.Item) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            transactionId: transactionId,
            transactionStatus: data.Item.transactionStatus,
            timestamp: data.Item.timestamp,
          }),
        };
      } else {
        return {
          statusCode: 404,
          body: JSON.stringify(
            `Transaction not found - TransactionId: ${transactionId}`
          ),
        };
      }
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify("Bad request"),
  };
};

function createInvoiceTransaction(key, requestId, expiresIn) {
  const timestamp = Date.now();
  const ttl = ~~(timestamp / 1000 + 60 * 3);

  const params = {
    TableName: invoicesDdb,
    Item: {
      pk: "#transaction",
      sk: key,
      ttl: ttl,
      requestId: requestId,
      transactionStatus: "URL_GENERATED",
      timestamp: timestamp,
      expiresIn: expiresIn,
    },
  };

  try {
    return ddbClient.put(params).promise();
  } catch (err) {
    console.error(err);
  }
}

function getInvoiceTransaction(key) {
  const params = {
    TableName: invoicesDdb,
    Key: {
      pk: "#transaction",
      sk: key,
    },
  };

  try {
    return ddbClient.get(params).promise();
  } catch (err) {
    return err;
  }
}
