const AWS = require("aws-sdk");
const AWSXRay = require("aws-xray-sdk-core");
const uuid = require("uuid");

const xRay = AWSXRay.captureAWS(require("aws-sdk"));

const productsDdb = process.env.PRODUCTS_DDB;
const ordersDdb = process.env.ORDERS_DDB;
const awsRegion = process.env.AWS_REGION;
const orderEventsTopicArn = process.env.ORDER_EVENTES_TOPIC_ARN;

AWS.config.update({
  region: awsRegion,
});

const ddbClient = new AWS.DynamoDB.DocumentClient();
const snsCliente = new AWS.SNS({ apiVersion: "2010-03-31"});

exports.handler = async function (event, context) {
  const method = event.httpMethod;

  const apiRequestId = event.requestContext.requestId;
  const lambdaRequestId = context.awsRequestId;

  console.log(
    `API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`
  );

  if (event.resource === "/orders") {
    if (method === "GET") {
      if (event.queryStringParameters) {
        if (event.queryStringParameters.username) {
          if (event.queryStringParameters.orderId) {
            //GET /orders?username=matilde&orderId=123
            //Get one order from an user
            const data = await getOrder(
              event.queryStringParameters.username,
              event.queryStringParameters.orderId
            );

            if (data.Item) {
              return {
                statusCode: 200,
                body: JSON.stringify(convertToOrderResponse(data.Item)),
              };
            } else {
              return {
                statusCode: 404,
                body: JSON.stringify("Order not found"),
              };
            }
          } else {
            //GET /orders?username=matilde
            //Get all orders from an user
            const data = await getOrdersByUsername(
              event.queryStringParameters.username
            );
            return {
              statusCode: 200,
              body: JSON.stringify(data.Items.map(convertToOrderResponse)),
            };
          }
        }
      } else {
        //GET /orders
        //Get all orders
        const data = await getAllOrders();
        return {
          statusCode: 200,
          body: JSON.stringify(data.Items.map(convertToOrderResponse)),
        };
      }
    } else if (method === "POST") {
      //Create an order
      const orderRequest = JSON.parse(event.body);
      const result = await fetchProducts(orderRequest);
      if (result.Responses.products.length == orderRequest.productIds.length) {
        const products = [];
        result.Responses.products.forEach((product) => {
          console.log(product);
          products.push(product);
        });

        const orderCreated = await createOrder(orderRequest, products);
        console.log(orderCreated);

        const eventResult = await sendOrderEvent(orderCreated, "ORDER_CREATED", lambdaRequestId)
        console.log(`Order created event sent - OrderId ${orderCreated.sk} - MessageId: ${eventResult.MessageId}`);


        return {
          statusCode: 201,
          body: JSON.stringify(convertToOrderResponse(orderCreated)),
        };
      } else {
        return {
          statusCode: 404,
          body: "Some product was not found",
        };
      }
    } else if (method === "DELETE") {
      if (
        event.queryStringParameters &&
        event.queryStringParameters.username &&
        event.queryStringParameters.orderId
      ) {
        //DELETE /orders?username=matilde&orderId=123
        //Delete an order
        const data = await getOrder(
          event.queryStringParameters.username,
          event.queryStringParameters.orderId
        );
        if (data.Item) {
          const deleteOrderPromise = deleteOrder(
            event.queryStringParameters.username,
            event.queryStringParameters.orderId
          );

          const deleteOrderEventPromise = sendOrderEvent(data.Item, "ORDER_DELETED", lambdaRequestId)
          
          const results = await Promise.all([
            deleteOrderPromise,
            deleteOrderEventPromise
          ]);

          console.log(`Order deleted event sent - OrderId: ${data.Item.sk} - MessageId: ${eventResult.MessageId}`);

          return {
            statusCode: 200,
            body: JSON.stringify(convertToOrderResponse(data.Item)),
          };
        } else {
          return {
            statusCode: 404,
            body: "Product not found",
          };
        }
      }
    }
  }
};

function deleteOrder(username, orderId) {
  const params = {
    TableName: ordersDdb,
    Key: {
      pk: username,
      sk: orderId,
    },
  };
  try {
    return ddbClient.delete(params).promise();
  } catch (err) {
    return err;
  }
}
function getOrder(username, orderId) {
  const params = {
    TableName: ordersDdb,
    Key: {
      pk: username,
      sk: orderId,
    },
  };
  try {
    return ddbClient.get(params).promise();
  } catch (err) {
    return err;
  }
}

function getOrdersByUsername(username) {
  const params = {
    TableName: ordersDdb,
    KeyConditionExpression: "pk = :username",
    ExpressionAttributeValues: {
      ":username": username,
    },
  };
  try {
    return ddbClient.query(params).promise();
  } catch (err) {
    console.log(err);
  }
}

function getAllOrders() {
  try {
    return ddbClient
      .scan({
        TableName: ordersDdb,
      })
      .promise();
  } catch (err) {
    return err;
  }
}

function sendOrderEvent(order, eventType, lambdaRequestId){
  const productCodes = [];
  order.products.forEach((prdutc) => {
    productCodes.push(productCode);
  });
  const orderEvent = {
    username: order.pk,
    orderId: order.sk,
    shipping: order.shipping,
    productCodes: productCodes,
    requestId: lambdaRequestId,
  };
  const envelope = {
    eventType: eventType,
    data: JSON.stringify(orderEvent),
  };

  const params = {
    Message: JSON.stringify(envelop),
    TopicArn: orderEventsTopicArn,
    MessageAttributes: {
      eventType: {
        DataType: "String",
        StringValue: eventType,
      },
    },
  };
  return snsCliente.publish(params).promise();
}

function convertToOrderResponse(order) {
  return {
    username: order.pk,
    id: order.sk,
    createdAt: order.createdAt,
    products: order.products,
    billing: {
      payment: order.billing.payment,
      totalPrice: order.billing.totalPrice,
    },
    shipping: {
      type: order.shipping.type,
      carrier: order.shipping.carrier,
    },
  };
}

async function createOrder(orderRequest, products) {
  const timestamp = Date.now();
  const orderProducts = [];
  let totalPrice = 0;

  /*
    products: [
      {
        code: "COD1",
        price: 10.5,
        id: "123-abc"
      },
      {
        code: "COD2",
        price: 20.5,
        id: "223-abc"
      }
    ]
  */
  products.forEach((product) => {
    totalPrice += product.price;

    orderProducts.push({
      code: product.code,
      price: product.price,
      id: product.id,
    });
  });

  const orderItem = {
    pk: orderRequest.username,
    sk: uuid.v4(),
    createdAt: timestamp,
    billing: {
      payment: orderRequest.payment,
      totalPrice: totalPrice,
    },
    shipping: {
      type: orderRequest.shipping.type,
      carrier: orderRequest.shipping.carrier,
    },
    products: orderProducts,
  };

  try {
    await ddbClient
      .put({
        TableName: ordersDdb,
        Item: orderItem,
      })
      .promise();
    return orderItem;
  } catch (err) {
    return err;
  }
}

function fetchProducts(orderRequest) {
  const keys = [];

  /*
    [
      { 
        id: "123-abc"
      },
      { 
        id: "123-cdb"
      }
    ]
  */
  orderRequest.productIds.forEach((productId) => {
    keys.push({
      id: productId,
    });
  });

  const params = {
    RequestItems: {
      products: {
        Keys: keys,
      },
    },
  };

  try {
    return ddbClient.batchGet(params).promise();
  } catch (err) {
    return err;
  }
}