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
  if (event.resource === "/products/events/{code}") {
    //GET /products/events/{code}
    const data = await getEventsByCode(event.pathParameters.code);
    return {
      body: JSON.stringify(convertItemsToEvents(data.Items)),
    };
  } else if (event.resource === "/products/events/{code}/{event}") {
    //GET /products/events/{code}/{event}
    const data = await getEventsByCodeAndEvent(
      event.pathParameters.code,
      event.pathParameters.event
    );
    return {
      body: JSON.stringify(convertItemsToEvents(data.Items)),
    };
  } else if (event.resource === "/products/events") {
    //with Global Secondary Index
    //GET /products/events?username=matilde
    if (event.queryStringParameters && event.queryStringParameters.username) {
      const data = await getEventsByUsername(
        event.queryStringParameters.username
      );
      return {
        body: JSON.stringify(convertItemsToEvents(data.Items)),
      };
    } else if (
      event.queryStringParameters &&
      event.queryStringParameters.username2
    ) {
      //without Global Secondary Index - GSI
      //GET /products/events?username2=doralice
      const data = await getEventsByUsername2(
        event.queryStringParameters.username2
      );
      return {
        body: JSON.stringify(convertItemsToEvents(data.Items)),
      };
    }
  }
  return {
    statusCode: 400,
    body: JSON.stringify("Bad request"),
  };
};

function convertItemsToEvents(items) {
  return items.map((item) => {
    return {
      createdAt: item.createdAt,
      eventType: item.sk.split("#")[0], //PRODUCT_CREATED#3213546
      username: item.username,
      productId: item.info.productId,
      requestId: item.requestId,
      code: item.pk.split("_")[1],
    };
  });
}

function getEventsByCode(code) {
  const params = {
    TableName: eventsDdb,
    KeyConditionExpression: "pk = :code",
    ExpressionAttributeValues: {
      ":code": `#product_${code}`,
    },
  };
  try {
    return ddbClient.query(params).promise();
  } catch (err) {
    return err;
  }
}

function getEventsByCodeAndEvent(code, event) {
  const params = {
    TableName: eventsDdb,
    KeyConditionExpression: "pk = :code AND begins_with (sk, :event)",
    ExpressionAttributeValues: {
      ":code": `#product_${code}`,
      ":event": event, //PRODUCT_UPDATED
    },
  };
  try {
    return ddbClient.query(params).promise();
  } catch (err) {
    return err;
  }
}

function getEventsByUsername2(username) {
  const params = {
    TableName: eventsDdb,
    FilterExpression: "username = :username AND begins_with(pk, :prefix)",
    ExpressionAttributeValues: {
      ":username": username,
      ":prefix": "#product_",
    },
  };
  try {
    return ddbClient.scan(params).promise();
  } catch (err) {
    return err;
  }
}

function getEventsByUsername(username) {
  const params = {
    TableName: eventsDdb,
    IndexName: "usernameIdx",
    KeyConditionExpression: "username = :username AND begins_with(pk, :prefix)",
    ExpressionAttributeValues: {
      ":username": username,
      ":prefix": "#product_",
    },
  };
  try {
    return ddbClient.query(params).promise();
  } catch (err) {
    return err;
  }
}