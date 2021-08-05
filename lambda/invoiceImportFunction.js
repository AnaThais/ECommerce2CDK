const AWS = require("aws-sdk");
const AWSXRay = require("aws-xray-sdk-core");

const xRay = AWSXRay.captureAWS(require("aws-sdk"));

const awsRegion = process.env.AWS_REGION;
const invoicesDdb = process.env.INVOICES_DDB;

AWS.config.update({
  region: awsRegion,
});

const s3Client = new AWS.S3({
  region: awsRegion,
});

const ddbClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async function (event, context) {
  console.log(event.Records[0].s3);

  const key = event.Records[0].s3.object.key;

  const invoiceTransactionResult = await getInvoiceTransaction(key);
  const invoiceTransaction = invoiceTransactionResult.Item;

  const params = {
    Key: key,
    Bucket: event.Records[0].s3.bucket.name,
  };

  const object = await s3Client.getObject(params).promise();
  const invoice = JSON.parse(object.Body.toString("utf-8"));
  console.log(invoice);

  if (invoiceTransaction) {
    await updateInvoiceTransaction(key, "INVOICE_RECEIVED");
  }

  if (invoice.invoiceNumber) {
    const createInvoicePromise = createInvoice(invoice, key);
    const deleteInvoicePromise = s3Client.deleteObject(params).promise();

    await Promise.all([createInvoicePromise, deleteInvoicePromise]);

    if (invoiceTransaction) {
      await updateInvoiceTransaction(key, "INVOICE_PROCESSED");
    }
  } else {
    if (invoiceTransaction) {
      await updateInvoiceTransaction(key, "FAIL_NO_INVOICE_NUMBER");
    }
  }
  return {};
};

function updateInvoiceTransaction(key, status) {
  const params = {
    TableName: invoicesDdb,
    Key: {
      pk: "#transaction",
      sk: key,
    },
    UpdateExpression: "set transactionStatus = :s",
    ExpressionAttributeValues: {
      ":s": status,
    },
  };

  try {
    return ddbClient.update(params).promise();
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

function createInvoice(invoice, key) {
  const params = {
    TableName: invoicesDdb,
    Item: {
      pk: `#invoice_${invoice.customerName}`,
      sk: invoice.invoiceNumber,
      totalValue: invoice.totalValue,
      productId: invoice.productId,
      quantity: invoice.quantity,
      transactionId: key,
      ttl: 0,
      createdAt: Date.now(),
    },
  };

  try {
    return ddbClient.put(params).promise();
  } catch (err) {
    console.error(err);
  }
}
