import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as dynamodb from "@aws-cdk/aws-dynamodb";

export class OrdersApplicationStack extends cdk.Stack {
  readonly ordersHandler: lambdaNodeJS.NodejsFunction;

  constructor(
        scope: cdk.Construct,
        id: string,
        productsDdb: dynamodb.Table,
        props?: cdk.StackProps
    ){
        super(scope, id, props);

        const ordersDdb = new dynamodb.Table(this, "OrdersDdb", {
            tableName: "orders",
            partitionKey: {
              name: "pk",
              type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
              name: "sk",
              type: dynamodb.AttributeType.STRING,
            },
            
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1,
          });
      

          this.ordersHandler = new lambdaNodeJS.NodejsFunction(this, "OrdersFunction", {
            functionName: "OrdersFunction",
            entry: "lambda/ordersFunction.js",
            handler: "handler",
            bundling: {
              minify: false,
              sourceMap: false,
            },
            tracing: lambda.Tracing.ACTIVE,
            memorySize: 128,
            timeout: cdk.Duration.seconds(30),
            environment: {
              PRODUCTS_DDB: productsDdb.tableName,
              ORDERS_DDB: ordersDdb.tableName,
            },

            
        });
        productsDdb.grantReadData(this.ordersHandler);
        ordersDdb.grantReadWriteData(this.ordersHandler);
    }

}