const AWS = require("aws-sdk");
const AWSXRay = require("aws-xray-sdk-core");
const { createExportDeclaration } = require("typescript");
const uuid = require("uuid");
const xRay = AWSXRay.captureAWS(require("aws-sdk"));

const productsDdb = process.env.PRODUCTS_DDB;
const awsRegion = process.env.AWS_REGION;
const orderDdb = process.env.ORDERS_DDB;

AWS.config.update({
    region: awsRegion,
});

const ddbClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async function (event, context) {

    const method = event.httpMethod;
    console.log(event);
    const apiRequestId = event.requestContext.requestId;
    const lambdaRequestId = context.awsRequestId;
    console.log(`API Gateway RequestId: ${apiRequestId}​ - Lambda RequestId: ${lambdaRequestId}​​`);

    if (event.resource === "/orders") {
        if (method === "GET") {
            if (event.queryStringParameters) {
                if (event.queryStringParameters.username) {
                    if (event.queryStringParameters.orderId) {
                   //Get one order from an user

                   const data = await getOrder(
                    event.queryStringParameters.username,
                    event.queryStringParameters.orderId

                   );

                   if (data.Item){

                    return {
                        statusCode: 200,
                        body: JSON.stringify(data.Item.map(convertTotOrderResponse))
                    }
                   }
                } else {
                    const data = await getOrdersByUsername(event.queryStringParameters.username);
                    return {
                        statusCode: 404,
                        body: JSON.stringify(data.Item.map(convertTotOrderResponse))
                    }
                }
            }
        } else {

            const data = await getAllOrders();
            return {
                statusCode: 200,
                body: JSON.stringify(data.Item.map(convertTotOrderResponse))
            }

            /***************************************** */

        //Get all orders
    }} else if (method === "POST") {
        //Create an order
        const orderRequest = JSON.parse(event.body);
        const result = await fetchProducts(orderRequest);
        if(result.Responses.products.length == order.Request.productIds.length){
            const products =[]
            result.Responses.products.forEach((product) => {
                console.log(product);
                products.push(product);
            });
            const orderCreated = await createExportDeclaration(orderRequest, products);
            console.log(orderCreated);

            return{
                statusCode: 201,
                body: JSON.stringify(convertToOrderResponse(orderCreated)),

            };
        }else {
            return{
                statusCode: 404,
                body: "some product was not found"

            }

        }
        

    } else if (method === "DELETE") {if (event.queryStringParameters &&
        event.queryStringParameters.username &&
        event.queryStringParameters.orderId
        ) {
        
            const data = await getOrder(event.queryStringParameters.username, event.queryStringParameters.orderId)
            if(data.Item) {
                await deleteOrder(event.queryStringParameters.username, event.queryStringParameters.orderId);
            
                return{
                    statusCode: 200,
                    body: JSON.stringify(convertToOrderResponse(data.Item)),
    
                };
            }else {

                return{
                    statusCode: 404,
                    body: "some product was not found"
                };
            }
        }
    }
}



};

function deleteOrder(username, orderID){
    const params = {
        TableName: orderDdb,
        Key:{
        pk: username,
        sk: orderId,
        },
    } 
    
    try{
        return ddbClient.delete(params).promise();
    }
    catch(err){
        return (err);
    }

}

function getOrder(ussername, orderId){
    const params= {
        TableName: orderDdb,
        Key:{
        pk: username,
        sk: orderId,
        }

    };
    try{
        return ddbClient.get(params).promise();
    }
    catch(err){
        return (err);
    }

}

function getOrdersByUsername(username){
    const params = {
        TableName: orderDdb,
        KeyConditionExpression: "pk = :username",
        ExpressionAttributeValues:{
            ":username" : username,
            }
        };
        try{
            return ddbClient()
        }catch (err){


        }

    
}

function getAllOrders(){
    try{
        return ddbClient.scan({
            TableName: orderDdb,
        }).promise();


    }catch (err){
        return err;

    }
}
function convertToOrderResponse(order){
    return{
        username: order.pk,
        id: order.sk,
        createdAt: order.createdAt,
        products: order.products,
        billing:{
            payment: order.billing.payment,
            totalPrice: order.billing.totalPrice,
        },
        shipping:{
            type: order.shipping.type,
            carrier:order.shipping.carrier,
        },
    };

}

async function createExportDeclaration(orderRequest, products){

    const timestamp = Data.now(),
    const orderProducts =[];
    let totalPrice = 0;

    products.forEach((product) =>{
        totalPrice += product.price;
        orderProducts.push({
            code : product.code,
            price : product.price,
            id: product.id,
       })
    });

    const orderItem = {
        pk: orderRequest.username,
        sk: uuid.v4(),
        createdAt: timeestamp,
        billingg:{
            payment: orderRequest.payment,
            totalPrice: totalPrice,
        },
        shipping:{
            type: orderRequest.shipping.type,
            carrier:orderRequest.shipping.carrier,

        },
        products: orderProducts,
    };

    try{
        await ddbClient.put({
            TableName: orderDdb,
            Item: orderItem,
        }).promise();
    }catch(err){
        return err;
    }

}




function fetchProducts(orderRequest){
    const keys =[];

    orderRequest.productId.forEach(element => {
        keys.push({
            id: productId,            
        });
    });
    const params = {
        RequestItems:{
            products: {
                Keys: keys,
            },
        },
    };
    try {
        return ddbClient.batchGet(params).promise();
    } catch (err){
        return err;
    }
    
}


     